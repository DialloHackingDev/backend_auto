import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtre global d'exceptions — Standardise toutes les réponses d'erreur
 * Format uniforme: { success, statusCode, message, error, timestamp, path }
 * 
 * ⚠️ En production, masque les détails sensibles des erreurs 500
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  
  // Déterminer l'environnement depuis le NODE_ENV à l'exécution
  private get isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Une erreur interne est survenue';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.message;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || message;
        error = (res.error as string) || error;

        // Gestion des erreurs de validation (tableau de messages)
        if (Array.isArray(res.message)) {
          message = (res.message as string[]).join(', ');
        }
      }
    } else if (exception instanceof Error) {
      message = this.isDevelopment ? exception.message : 'Une erreur système est survenue';
      error = exception.name;
    }

    // Log l'erreur complet (stack trace en dev seulement)
    if (statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} — ${statusCode}`,
        this.isDevelopment && exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `[${request.method}] ${request.url} — ${statusCode}: ${message}`,
      );
    }

    // En production, ne pas révéler les détails des erreurs 500
    if (!this.isDevelopment && statusCode >= 500) {
      message = 'Erreur serveur. Veuillez contacter le support.';
      error = 'Internal Server Error';
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
