import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './index.css'
import App from './App.tsx'
import { detectPreferredLanguage, initAppI18n, initAppI18nAsync, setAppLanguage } from './i18n'
import { initFirestoreSync } from './lib/firestoreSync'
import {
  hideNativeSplash,
  initNativeKeyboardBridge,
  syncNativeTheme,
} from './lib/nativeBridge'
import { useStore } from './store/useStore'

// Inicia escuta em tempo real do Firestore para utilizador autenticado
initFirestoreSync();

// Ponte nativa (Tema Sistema/Claro/Escuro, StatusBar, Teclado virtual e Splash Screen)
const initialSettings = useStore.getState().settings;
const initialLanguage = detectPreferredLanguage(initialSettings.language);
useStore.subscribe((state, prevState) => {
  const nextLang = state.settings.language ?? 'pt-PT';
  const prevLang = prevState.settings.language ?? 'pt-PT';
  if (nextLang !== prevLang) {
    setAppLanguage(nextLang);
  }
});
void syncNativeTheme(
  initialSettings.theme,
  initialSettings.themePalette ?? 'caderno',
  initialSettings.appTone ?? 'vibrante',
);
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = useStore.getState().settings;
    if (current.theme === 'system') {
      void syncNativeTheme(
        'system',
        current.themePalette ?? 'caderno',
        current.appTone ?? 'vibrante',
      );
    }
  });
}
void initNativeKeyboardBridge();
void hideNativeSplash();

// Navegação com botão Voltar no Android nativo (Capacitor)
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const openDialog = document.querySelector('dialog[open]') as HTMLDialogElement | null;
    if (openDialog) {
      openDialog.close();
      return;
    }
    if (canGoBack) {
      window.history.back();
    } else {
      void CapacitorApp.exitApp();
    }
  }).catch(() => {});
}

// Regista Service Worker PWA apenas em Web produção (nunca dentro do Android Capacitor)
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  !Capacitor.isNativePlatform()
) {
  // Se um chunk lazy falhar após nova publicação (aba antiga aberta), recarrega uma vez para buscar o index.html novo.
  window.addEventListener('vite:preloadError', () => {
    try {
      const key = 'unipedia-chunk-reload';
      const prev = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - prev > 30_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // ignora em contextos sem sessionStorage
    }
  });

  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update().catch(() => undefined))
      .catch(() => {});
  });
}

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

if (initialLanguage === 'pt-PT') {
  initAppI18n('pt-PT');
  renderApp();
} else {
  void initAppI18nAsync(initialLanguage).finally(renderApp);
}
