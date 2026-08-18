import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { SUPER_ADMIN_SLUG } from '../../common/constants/permissions';
import {
  PERMISSION_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  USER_REPOSITORY,
} from '../../common/constants/tokens';
import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import { BaseEntity, ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { UserEntity } from '../users/entities/user.entity';
import { PermissionEntity, RoleEntity } from '../roles/entities/role.entity';
import { LoginDto, TwoFaLoginDto } from './dto/auth.dto';

interface RefreshTokenEntity extends BaseEntity {
  userId: string;
  tokenHash: string;
  expiresAt: Date | string;
  revokedAt?: Date | string | null;
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: ICrudRepository<UserEntity>,
    @Inject(ROLE_REPOSITORY) private readonly roles: ICrudRepository<RoleEntity>,
    @Inject(PERMISSION_REPOSITORY) private readonly permissions: ICrudRepository<PermissionEntity>,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: ICrudRepository<RefreshTokenEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cache: AppCacheService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.users.findOne({ email: dto.email.toLowerCase() });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'active') throw new UnauthorizedException('Account is not active');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.totpEnabled) {
      if (dto.totpCode) {
        this.assertTotp(user, dto.totpCode);
        return this.issueSession(user, meta);
      }
      const challengeToken = this.jwt.sign(
        { sub: user.id, email: user.email, typ: '2fa' },
        {
          secret: this.config.get('JWT_ACCESS_SECRET'),
          expiresIn: '5m',
        },
      );
      return {
        requires2fa: true,
        challengeToken,
      };
    }

    return this.issueSession(user, meta);
  }

  async verifyTwoFactor(dto: TwoFaLoginDto, meta: { ip?: string; userAgent?: string }) {
    let payload: { sub: string; typ?: string };
    try {
      payload = this.jwt.verify(dto.challengeToken, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }
    if (payload.typ !== '2fa') throw new UnauthorizedException('Invalid token type');
    const user = await this.users.findById(payload.sub);
    if (!user || !user.totpEnabled) throw new UnauthorizedException('2FA is not enabled');
    this.assertTotp(user, dto.code);
    return this.issueSession(user, meta);
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const hash = this.hashToken(refreshToken);
    const stored = await this.refreshTokens.findOne({ tokenHash: hash });
    if (!stored || stored.revokedAt) throw new UnauthorizedException('Invalid refresh token');
    if (new Date(stored.expiresAt) < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    const user = await this.users.findById(stored.userId);
    if (!user || user.status !== 'active') throw new UnauthorizedException('Account is not active');
    await this.refreshTokens.update(stored.id, { revokedAt: new Date().toISOString() } as Partial<RefreshTokenEntity>);
    return this.issueSession(user, meta);
  }

  async logout(refreshToken: string): Promise<{ loggedOut: true }> {
    const hash = this.hashToken(refreshToken);
    const stored = await this.refreshTokens.findOne({ tokenHash: hash }, true);
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.update(stored.id, { revokedAt: new Date().toISOString() } as Partial<RefreshTokenEntity>);
    }
    return { loggedOut: true };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const permissions = await this.resolvePermissions(user);
    const role = await this.resolveRoleSlug(user);
    const { passwordHash, totpSecret, partnerKey, ...safe } = user;
    return { ...safe, role, permissions, totpEnabled: Boolean(user.totpEnabled) };
  }

  async setupTotp(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = authenticator.generateSecret();
    await this.cache.set(`totp-setup:${userId}`, secret, 600);
    const issuer = 'SARI CMS';
    const otpauth = authenticator.keyuri(user.email, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    return { secret, otpauth, qrDataUrl };
  }

  async enableTotp(userId: string, code: string) {
    const secret = await this.cache.get<string>(`totp-setup:${userId}`);
    if (!secret) throw new BadRequestException('No TOTP setup in progress');
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) throw new BadRequestException('Invalid TOTP code');
    await this.users.update(userId, { totpEnabled: true, totpSecret: secret } as Partial<UserEntity>);
    await this.cache.del(`totp-setup:${userId}`);
    await this.audit.record({ actorId: userId, action: '2fa_enabled', resource: 'users', resourceId: userId });
    return { totpEnabled: true };
  }

  async disableTotp(userId: string, code: string) {
    const user = await this.users.findById(userId);
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA is not enabled');
    }
    this.assertTotp(user, code);
    await this.users.update(userId, { totpEnabled: false, totpSecret: null } as Partial<UserEntity>);
    await this.audit.record({ actorId: userId, action: '2fa_disabled', resource: 'users', resourceId: userId });
    return { totpEnabled: false };
  }

  async resolvePermissions(user: UserEntity): Promise<string[]> {
    const cacheKey = `perms:${user.id}:${user.roleId ?? 'none'}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    if (!user.roleId) {
      return user.type === 'admin' ? ['*'] : [];
    }
    const role = await this.roles.findById(user.roleId);
    if (!role) return [];
    if (role.slug === SUPER_ADMIN_SLUG) {
      await this.cache.set(cacheKey, ['*'], 60);
      return ['*'];
    }
    const ids = role.permissionIds ?? [];
    const perms: string[] = [];
    for (const id of ids) {
      const p = await this.permissions.findById(id);
      if (p) perms.push(`${p.resource}:${p.action}`);
    }
    await this.cache.set(cacheKey, perms, 60);
    return perms;
  }

  async resolveRoleSlug(user: UserEntity): Promise<string | undefined> {
    if (!user.roleId) return user.type === 'admin' ? SUPER_ADMIN_SLUG : undefined;
    const role = await this.roles.findById(user.roleId);
    return role?.slug;
  }

  private async issueSession(user: UserEntity, meta: { ip?: string; userAgent?: string }) {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, typ: 'access' },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') || '15m',
      },
    );
    const refreshRaw = randomBytes(48).toString('hex');
    const days = this.parseTtlDays(this.config.get('JWT_REFRESH_TTL') || '7d');
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    await this.refreshTokens.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.hashToken(refreshRaw),
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Partial<RefreshTokenEntity>);

    await this.users.update(user.id, { lastLoginAt: new Date().toISOString() } as Partial<UserEntity>);
    await this.audit.record({
      actorId: user.id,
      action: 'login',
      resource: 'auth',
      resourceId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const permissions = await this.resolvePermissions(user);
    return {
      requires2fa: false,
      accessToken,
      refreshToken: refreshRaw,
      expiresIn: this.config.get('JWT_ACCESS_TTL') || '15m',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        type: user.type,
        role: await this.resolveRoleSlug(user),
        permissions,
        totpEnabled: Boolean(user.totpEnabled),
      },
    };
  }

  private assertTotp(user: UserEntity, code: string): void {
    if (!user.totpSecret) throw new UnauthorizedException('2FA is not configured');
    const valid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!valid) throw new UnauthorizedException('Invalid TOTP code');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlDays(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 7;
    const n = Number(match[1]);
    switch (match[2]) {
      case 's':
        return n / 86400;
      case 'm':
        return n / 1440;
      case 'h':
        return n / 24;
      default:
        return n;
    }
  }
}
