import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/bricolage-grotesque'
import './index.css'
import App from './App.tsx'
import { initFirestoreSync } from './lib/firestoreSync'

// Inicia escuta em tempo real do Firestore para utilizador autenticado
initFirestoreSync();

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
