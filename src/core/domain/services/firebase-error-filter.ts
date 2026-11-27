/**
 * Identifies the known upstream @firebase/auth AbstractPopupRedirectOperation / _PopupOperation
 * race condition where the popup-closed watcher settles and clears `pendingPromise` right while
 * `onAuthEvent` is awaiting `_signIn()`, causing a spurious post-settlement assertion error.
 */
export function isFirebasePopupAssertionRace(error: unknown): boolean {
  if (!error) return false;

  const message = extractErrorMessage(error);
  if (!message) return false;

  return (
    message.includes('Pending promise was never set') &&
    message.includes('INTERNAL ASSERTION FAILED')
  );
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    return `${error.message} ${error.stack ?? ''}`;
  }
  if (typeof error === 'object') {
    const rec = error as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof rec['message'] === 'string') parts.push(rec['message']);
    if (typeof rec['stack'] === 'string') parts.push(rec['stack']);
    if (rec['rejection']) parts.push(extractErrorMessage(rec['rejection']));
    if (rec['reason']) parts.push(extractErrorMessage(rec['reason']));
    return parts.join(' ');
  }
  return '';
}
