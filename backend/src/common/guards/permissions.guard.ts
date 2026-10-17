import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CRUD_RESOURCE_KEY } from '../decorators/crud-resource.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { SUPER_ADMIN_SLUG } from '../constants/permissions';

function inferAction(req: Request): string {
  const url = req.url || '';
  const method = (req.method || 'GET').toUpperCase();
  if (url.includes('/purge')) return 'delete';
  if (url.includes('/restore')) return 'update';
  if (method === 'GET') return 'read';
  if (method === 'POST' && /\/\d+\//.test(url)) return 'update';
  if (method === 'POST') return 'create';
  if (method === 'PATCH' || method === 'PUT') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'read';
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    let required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const resource = this.reflector.getAllAndOverride<string>(CRUD_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (resource && !required?.length) {
      const req = context.switchToHttp().getRequest<Request>();
      required = [`${resource}:${inferAction(req)}`];
    }

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');
    if (user.role === SUPER_ADMIN_SLUG || user.permissions.includes('*')) return true;

    const ok = required.every(
      (perm) =>
        user.permissions.includes(perm) ||
        user.permissions.includes(`${perm.split(':')[0]}:admin`) ||
        user.permissions.includes('*:admin'),
    );
    if (!ok) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
