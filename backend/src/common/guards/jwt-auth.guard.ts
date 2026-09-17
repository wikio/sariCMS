import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      // Public route: tente d'authentifier si un token est présent mais ne bloque pas si absent/invalide.
      // handleRequest() renverra null au lieu de lever, donc la requête passe même sans JWT.
      // Actor sera vide dans ce cas, mais peuplé si le token est valide.
      return super.canActivate(context) as any;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const isPublic = (() => {
      try {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);
      } catch {
        return false;
      }
    })();
    if (isPublic) {
      // Public: ne lève pas si pas de user, renvoie null -> requête autorisée mais anonyme.
      if (err || !user) return null;
      return user;
    }
    if (err || !user) throw err || new UnauthorizedException('Unauthorized');
    return user;
  }
}
