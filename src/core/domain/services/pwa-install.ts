export type PwaInstallBannerMode = 'prompt' | 'ios-guide' | 'hidden';

export interface PwaEnvironmentSnapshot {
  readonly userAgent: string;
  readonly maxTouchPoints?: number;
  readonly displayModeStandalone: boolean;
  readonly navigatorStandalone?: boolean;
  readonly hasDeferredPrompt: boolean;
  readonly dismissed: boolean;
}

/**
 * Pure detector for iOS / iPadOS devices (including iPadOS 13+ desktop Safari UA).
 */
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return true;
  }
  return ua.includes('macintosh') && maxTouchPoints > 1;
}

/**
 * Pure detector for Safari on iOS/iPadOS (excludes third-party iOS browsers like CriOS/FxiOS/EdgiOS
 * where the Add to Home Screen flow differs, though iOS Chrome also supports Share -> Add to Home Screen).
 */
export function isIosSafariOrWebKit(userAgent: string, maxTouchPoints = 0): boolean {
  return isIosDevice(userAgent, maxTouchPoints);
}

/**
 * Pure detector for installed standalone PWA mode across Android Chrome, Desktop PWA, and iOS Safari.
 */
export function isStandaloneDisplayMode(
  displayModeStandalone: boolean,
  navigatorStandalone?: boolean,
): boolean {
  return Boolean(displayModeStandalone || navigatorStandalone === true);
}

/**
 * Decides whether the discreet in-app PWA install UI should render a native prompt button,
 * an iOS Safari installation guide, or stay hidden.
 */
export function resolveInstallBannerMode(env: PwaEnvironmentSnapshot): PwaInstallBannerMode {
  if (env.dismissed) {
    return 'hidden';
  }
  if (isStandaloneDisplayMode(env.displayModeStandalone, env.navigatorStandalone)) {
    return 'hidden';
  }
  if (env.hasDeferredPrompt) {
    return 'prompt';
  }
  if (isIosSafariOrWebKit(env.userAgent, env.maxTouchPoints ?? 0)) {
    return 'ios-guide';
  }
  return 'hidden';
}

/**
 * Determines whether the current origin is eligible to register a Service Worker safely.
 */
export function canRegisterServiceWorker(protocol: string, hostname: string): boolean {
  if (protocol === 'https:') {
    return true;
  }
  return (
    protocol === 'http:' &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]')
  );
}
