import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  let apiReq = req;
  if (token) {
    apiReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(apiReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('[AuthInterceptor] Token expirado o no autorizado (401). Cerrando sesión...');

        // Limpiar almacenamiento y cookies de forma segura
        localStorage.clear();
        sessionStorage.clear();
        document.cookie = 'datapipe_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

        // Redirigir al usuario al login
        window.location.href = '/auth';
      }
      return throwError(() => error);
    })
  );
};
