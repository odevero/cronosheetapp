import { ErrorHandler, Injectable } from '@angular/core';
import { isFirebasePopupAssertionRace } from '../../domain/services/firebase-error-filter';

let rejectionGuardInstalled = false;

/**
 * Installs a capture-phase unhandledrejection guard strictly scoped to the known
 * upstream @firebase/auth _PopupOperation post-settlement assertion race.
 * All other unhandled rejections propagate normally.
 */
export function installFirebasePopupRejectionGuard(): void {
  if (typeof window === 'undefined' || rejectionGuardInstalled) {
    return;
  }
  rejectionGuardInstalled = true;

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      if (isFirebasePopupAssertionRace(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

@Injectable()
export class CronoSheetErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    if (isFirebasePopupAssertionRace(error)) {
      return;
    }
    super.handleError(error);
  }
}
