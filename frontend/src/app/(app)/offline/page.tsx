/**
 * Offline fallback page — /offline
 *
 * This page is statically exported to /offline.html and registered with the
 * Workbox service worker as the document fallback.  It is served automatically
 * whenever a navigation request fails (no network AND no cache hit).
 *
 * Kept as a simple Server Component with no dynamic data so it is always
 * included in the precache manifest and works in any network state.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline — VeoBible',
  description: 'You are offline. Please check your internet connection.',
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <>
      <style>{`
        .offline-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: var(--bg-page, #0f0e17);
        }

        .offline-card {
          background: var(--bg-card, #1a1929);
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 1.5rem;
          padding: 3rem 2.5rem;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 8px 40px rgba(0,0,0,0.18);
        }

        .offline-icon-wrap {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: var(--brand-light, rgba(124,106,247,0.15));
          border: 1px solid rgba(124,106,247,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.75rem;
          color: var(--brand, #7c6af7);
        }

        .offline-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary, #fffffe);
          margin-bottom: 0.75rem;
          line-height: 1.25;
        }

        .offline-subtitle {
          font-size: 0.9375rem;
          color: var(--text-secondary, rgba(255,255,255,0.6));
          line-height: 1.6;
          margin-bottom: 2rem;
        }

        .offline-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .offline-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: var(--brand, #7c6af7);
          color: #fff;
          border: none;
          border-radius: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        .offline-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .offline-btn-primary:active { opacity: 1; transform: translateY(0); }

        .offline-btn-ghost {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: transparent;
          color: var(--text-secondary, rgba(255,255,255,0.6));
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }

        .offline-btn-ghost:hover {
          border-color: var(--brand, #7c6af7);
          color: var(--text-primary, #fffffe);
          transform: translateY(-1px);
        }

        .offline-tip {
          margin-top: 2rem;
          padding: 0.875rem 1rem;
          background: var(--brand-light, rgba(124,106,247,0.15));
          border: 1px solid rgba(124,106,247,0.2);
          border-radius: 0.75rem;
          font-size: 0.8125rem;
          color: var(--text-muted, rgba(255,255,255,0.38));
          line-height: 1.55;
          text-align: left;
        }

        .offline-tip strong {
          color: var(--brand, #7c6af7);
          font-weight: 600;
        }
      `}</style>

      <div className="offline-page">
        <div className="offline-card">
          {/* WiFi-off icon */}
          <div className="offline-icon-wrap" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <circle cx="12" cy="20" r="1" fill="currentColor" strokeWidth="0" />
            </svg>
          </div>

          <h1 className="offline-title" id="offline-title">
            No internet connection
          </h1>
          <p className="offline-subtitle" id="offline-subtitle">
            It looks like you are offline. Pages you have visited before are still available.
          </p>

          <div className="offline-actions">
            <a href="/" className="offline-btn-primary" id="offline-go-home">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Go to home</span>
            </a>
            <button
              className="offline-btn-ghost"
              id="offline-go-back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Go back</span>
            </button>
          </div>

          <div className="offline-tip" id="offline-tip">
            <strong>Tip:</strong>{' '}Download a Bible version from the reader to always have it available offline — even without internet.
          </div>
        </div>
      </div>

      {/* Client-side: localize text + auto-reload when back online */}
      <script
        id="offline-init"
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  'use strict';
  var strings = {
    en: {
      title: 'No internet connection',
      subtitle: 'It looks like you are offline. Pages you have visited before are still available.',
      goHome: 'Go to home',
      goBack: 'Go back',
      tip: '<strong>Tip:</strong> Download a Bible version from the reader to always have it available offline.',
    },
    es: {
      title: 'Sin conexión a internet',
      subtitle: 'Parece que estás sin conexión. Las páginas que ya visitaste siguen disponibles.',
      goHome: 'Ir al inicio',
      goBack: 'Volver',
      tip: '<strong>Consejo:</strong> Descarga una versión de la Biblia desde el lector para tenerla siempre disponible sin conexión.',
    },
  };

  // Detect language: URL prefix > saved localStorage pref > browser language
  function detectLang() {
    try {
      var prefs = JSON.parse(localStorage.getItem('veobible-preferences') || '{}');
      if (prefs.locale === 'es') return 'es';
      if (prefs.locale === 'en') return 'en';
    } catch (_) {}
    return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  }

  var lang = detectLang();
  var s = strings[lang] || strings.en;

  var title = document.getElementById('offline-title');
  var subtitle = document.getElementById('offline-subtitle');
  var goHome = document.getElementById('offline-go-home');
  var goBack = document.getElementById('offline-go-back');
  var tip = document.getElementById('offline-tip');

  if (title) title.textContent = s.title;
  if (subtitle) subtitle.textContent = s.subtitle;
  if (goHome) goHome.querySelector('span').textContent = s.goHome;
  if (goBack) goBack.querySelector('span').textContent = s.goBack;
  if (goBack) goBack.addEventListener('click', function () { window.history.back(); });
  if (tip) tip.innerHTML = s.tip;

  // Auto-reload when the connection is restored
  window.addEventListener('online', function () {
    window.location.reload();
  });
})();
          `,
        }}
      />
    </>
  )
}
