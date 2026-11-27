import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRegisterServiceWorker,
  isIosDevice,
  isStandaloneDisplayMode,
  resolveInstallBannerMode,
} from '../domain/services/pwa-install';

test('isIosDevice detects iPhone, iPad, iPod, and iPadOS desktop Safari', () => {
  assert.equal(
    isIosDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    ),
    true,
  );
  assert.equal(
    isIosDevice(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      5,
    ),
    true,
  );
  assert.equal(
    isIosDevice(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      0,
    ),
    false,
  );
  assert.equal(
    isIosDevice(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      5,
    ),
    false,
  );
});

test('isStandaloneDisplayMode detects both matchMedia standalone and iOS navigator.standalone', () => {
  assert.equal(isStandaloneDisplayMode(true, false), true);
  assert.equal(isStandaloneDisplayMode(false, true), true);
  assert.equal(isStandaloneDisplayMode(false, false), false);
  assert.equal(isStandaloneDisplayMode(false, undefined), false);
});

test('resolveInstallBannerMode prioritizes suppression when standalone or dismissed', () => {
  assert.equal(
    resolveInstallBannerMode({
      userAgent: 'Android Chrome',
      displayModeStandalone: true,
      hasDeferredPrompt: true,
      dismissed: false,
    }),
    'hidden',
  );
  assert.equal(
    resolveInstallBannerMode({
      userAgent: 'iPhone Safari',
      displayModeStandalone: false,
      navigatorStandalone: true,
      hasDeferredPrompt: false,
      dismissed: false,
    }),
    'hidden',
  );
  assert.equal(
    resolveInstallBannerMode({
      userAgent: 'Android Chrome',
      displayModeStandalone: false,
      hasDeferredPrompt: true,
      dismissed: true,
    }),
    'hidden',
  );
});

test('resolveInstallBannerMode selects prompt on Chromium/Android and ios-guide on iOS', () => {
  assert.equal(
    resolveInstallBannerMode({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0.0.0 Mobile',
      displayModeStandalone: false,
      hasDeferredPrompt: true,
      dismissed: false,
    }),
    'prompt',
  );
  assert.equal(
    resolveInstallBannerMode({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1',
      displayModeStandalone: false,
      hasDeferredPrompt: false,
      dismissed: false,
    }),
    'ios-guide',
  );
  assert.equal(
    resolveInstallBannerMode({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0.0.0',
      displayModeStandalone: false,
      hasDeferredPrompt: false,
      dismissed: false,
    }),
    'hidden',
  );
});

test('canRegisterServiceWorker allows https and localhost only', () => {
  assert.equal(canRegisterServiceWorker('https:', 'cronosheetapp.web.app'), true);
  assert.equal(canRegisterServiceWorker('http:', 'localhost'), true);
  assert.equal(canRegisterServiceWorker('http:', '127.0.0.1'), true);
  assert.equal(canRegisterServiceWorker('http:', 'example.com'), false);
});
