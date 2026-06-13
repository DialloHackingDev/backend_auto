import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Interceptor de logging — Enregistre chaque requête avec durée
 * Transforme aussi les réponses en format standardisé
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - startTime;
        this.logger.log(
          `[${method}] ${url} ${res.statusCode} — ${duration}ms — ${ip} — ${userAgent}`,
        );
      }),
      map((data) => ({
        success: true,
        message: 'Opération réussie',
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
