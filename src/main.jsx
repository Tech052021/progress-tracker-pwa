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

// Only register the service worker in production builds. During local development
// the service worker interferes with HMR / dev updates, so skip registration.
if (import.meta.env && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
