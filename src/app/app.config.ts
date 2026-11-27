import {
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {
  CronoSheetErrorHandler,
  installFirebasePopupRejectionGuard,
} from '../core/adapters/firebase/firebase-error-handler';

installFirebasePopupRejectionGuard();

export const appConfig: ApplicationConfig = {
  providers: [
    {provide: ErrorHandler, useClass: CronoSheetErrorHandler},
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
  ],
};
