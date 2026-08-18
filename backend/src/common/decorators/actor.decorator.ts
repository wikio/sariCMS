import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActorContext } from '../crud/base-crud.service';
import { AuthUser } from './current-user.decorator';

export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): ActorContext => {
  const req = ctx.switchToHttp().getRequest<{
    user?: AuthUser;
    ip?: string;
    headers: Record<string, string | string[] | undefined>;
  }>();
  return {
    id: req.user?.id,
    email: req.user?.email,
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] ?? ''),
  };
});
