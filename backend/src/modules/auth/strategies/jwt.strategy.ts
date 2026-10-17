import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { USER_REPOSITORY } from '../../../common/constants/tokens';
import { ICrudRepository } from '../../../common/crud/interfaces/repository.interface';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { UserEntity } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string | number;
  email: string;
  typ?: 'access' | 'refresh' | '2fa';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: ICrudRepository<UserEntity>,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'dev-access-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ && payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    // `sub` peut être un entier (MySQL/Postgres) ou un UUID (driver JSON) :
    // Number('c5c1...') vaut NaN et faisait échouer toute requête authentifiée.
    const rawSub = payload.sub;
    const subId = (typeof rawSub === 'number' || /^\d+$/.test(String(rawSub))
      ? Number(rawSub)
      : rawSub) as unknown as number;
    const user = await this.users.findById(subId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }
    const permissions = await this.auth.resolvePermissions(user);
    return {
      id: user.id,
      email: user.email,
      type: String(user.type),
      role: await this.auth.resolveRoleSlug(user),
      permissions,
    };
  }
}
