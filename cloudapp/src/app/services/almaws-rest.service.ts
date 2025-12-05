// src/app/services/almaws-rest.service.ts
import { Injectable } from '@angular/core';
import {
  CloudAppRestService,
  Request,
  HttpMethod
} from '@exlibris/exl-cloudapp-angular-lib';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface RestError extends Error {
  ok: boolean;
  status: number;
  statusText: string;
  error?: any;
}

/**
 * Thin wrapper around CloudAppRestService with:
 * - typed generics
 * - shared error mapping
 * - convenience methods for GET/POST/PUT/DELETE
 *
 * This service should not invent any Alma-specific behavior;
 * it only handles basic REST concerns.
 */
@Injectable({ providedIn: 'root' })
export class AlmaWsRestService {

  constructor(
    private rest: CloudAppRestService
  ) {}

  /**
   * Low-level call wrapper that all verbs go through.
   */
  call<T = any>(options: {
    url: string;
    method: HttpMethod;
    requestBody?: any;
    queryParams?: Record<string, any>;
  }): Observable<T> {
    const req: Request = {
      url: options.url,
      method: options.method,
    };

    if (options.requestBody !== undefined) {
      (req as any).requestBody = options.requestBody;
    }

    if (options.queryParams) {
      (req as any).queryParams = options.queryParams;
    }

    return this.rest.call(req).pipe(
      map((resp: any) => resp as T),
      catchError((err: any) => {
        const restError: RestError = {
          name: 'RestError',
          message: err?.message || 'Alma REST call failed',
          ok: !!err?.ok,
          status: typeof err?.status === 'number' ? err.status : 0,
          statusText: err?.statusText || '',
          error: err?.error
        };
        return throwError(() => restError);
      })
    );
  }

  /**
   * GET convenience wrapper.
   */
  get<T = any>(
    url: string,
    queryParams?: Record<string, any>
  ): Observable<T> {
    return this.call<T>({
      url,
      method: HttpMethod.GET,
      queryParams
    });
  }

  /**
   * POST convenience wrapper.
   */
  post<T = any>(
    url: string,
    requestBody?: any,
    queryParams?: Record<string, any>
  ): Observable<T> {
    return this.call<T>({
      url,
      method: HttpMethod.POST,
      requestBody,
      queryParams
    });
  }

  /**
   * PUT convenience wrapper.
   */
  put<T = any>(
    url: string,
    requestBody?: any,
    queryParams?: Record<string, any>
  ): Observable<T> {
    return this.call<T>({
      url,
      method: HttpMethod.PUT,
      requestBody,
      queryParams
    });
  }

  /**
   * DELETE convenience wrapper.
   */
  delete<T = any>(
    url: string,
    queryParams?: Record<string, any>
  ): Observable<T> {
    return this.call<T>({
      url,
      method: HttpMethod.DELETE,
      queryParams
    });
  }
}
