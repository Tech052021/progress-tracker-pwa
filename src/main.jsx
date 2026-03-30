import * as React from 'react';
import ReactDOM from 'react-dom/client';
try { window.React = React; } catch (e) { }
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// In local development, remove any previously installed service workers/caches
// so localhost always reflects the latest source + HMR changes.
if (import.meta.env && import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => (window.caches ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))) : null))
      .then(() => {
        if (hadController) {
          window.location.reload();
        }
      })
      .catch(() => {});
  });
}

// Only register the service worker in production builds. During local development
// the service worker interferes with HMR / dev updates, so skip registration.
if (import.meta.env && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Poll periodically so open tabs pick up newly deployed builds.
      window.setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    }).catch(() => {});
  });
}
