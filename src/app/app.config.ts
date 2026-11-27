import {
  ApplicationConfig,
  ErrorHandler,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {hydrateFirebaseRuntimeConfig} from '../core/adapters/firebase/firebase-client';
import {
  CronoSheetErrorHandler,
  installFirebasePopupRejectionGuard,
} from '../core/adapters/firebase/firebase-error-handler';

installFirebasePopupRejectionGuard();

export const appConfig: ApplicationConfig = {
  providers: [
    {provide: ErrorHandler, useClass: CronoSheetErrorHandler},
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => hydrateFirebaseRuntimeConfig()),
    provideRouter(routes),
  ],
};
