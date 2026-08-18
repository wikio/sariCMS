import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    let message: string | string[] = 'Internal server error';
    let details: unknown;

    if (typeof raw === 'string') {
      message = raw;
    } else if (raw && typeof raw === 'object') {
      const body = raw as { message?: string | string[]; error?: string };
      message = body.message ?? body.error ?? message;
      details = body;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const i18n = I18nContext.current();
    const localized =
      typeof message === 'string' && i18n && message.startsWith('errors.')
        ? i18n.t(message)
        : message;

    res.status(status).json({
      success: false,
      statusCode: status,
      message: localized,
      path: req.url,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== 'production' && details ? { details } : {}),
    });
  }
}
