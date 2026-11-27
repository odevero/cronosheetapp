import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';
import {canRegisterServiceWorker} from './core/domain/services/pwa-install';

bootstrapApplication(App, appConfig)
  .then(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      canRegisterServiceWorker(window.location.protocol, window.location.hostname)
    ) {
      const registerSw = () => {
        navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(() => {
          // Ignore registration errors in restricted preview/sandbox frames
        });
      };

      if (document.readyState === 'complete') {
        registerSw();
      } else {
        window.addEventListener('load', registerSw, {once: true});
      }
    }
  })
  .catch((err) => console.error(err));
