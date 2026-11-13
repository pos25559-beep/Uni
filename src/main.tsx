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
const initialTheme = useStore.getState().settings.theme;
void syncNativeTheme(initialTheme);
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = useStore.getState().settings.theme;
    if (current === 'system') void syncNativeTheme('system');
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
