import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

const DARK_BG = '#141311';
const LIGHT_BG = '#FAF8F2';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeChromePlugin {
  apply(options: { color: string; isDark: boolean }): Promise<void>;
}

const ThemeChrome = registerPlugin<ThemeChromePlugin>('ThemeChrome');

/** Resolve se o tema efetivo deve ser escuro dado o modo escolhido pelo utilizador. */
export function resolveIsDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

/** Aplica a classe dark no DOM e sincroniza a barra de estado Android/iOS com o tema atual. */
export async function syncNativeTheme(pref: ThemePreference): Promise<void> {
  const isDark = resolveIsDark(pref);
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark);
  }
  if (!Capacitor.isNativePlatform()) return;
  const color = isDark ? DARK_BG : LIGHT_BG;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color });
      await ThemeChrome.apply({ color, isDark });
    }
  } catch {
    // Algumas versões de WebView ignoram overlay/cor em emuladores antigos.
  }
}

/** Expõe --keyboard-height em :root para compositores e bottom sheets subirem com o teclado nativo. */
export function initNativeKeyboardBridge(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const root = document.documentElement;
  let active = true;
  const handles: Array<{ remove: () => Promise<void> }> = [];

  void Keyboard.addListener('keyboardWillShow', (info) => {
    if (active) root.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
  }).then((h) => handles.push(h)).catch(() => {});

  void Keyboard.addListener('keyboardDidShow', (info) => {
    if (active) root.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
  }).then((h) => handles.push(h)).catch(() => {});

  void Keyboard.addListener('keyboardWillHide', () => {
    if (active) root.style.setProperty('--keyboard-height', '0px');
  }).then((h) => handles.push(h)).catch(() => {});

  void Keyboard.addListener('keyboardDidHide', () => {
    if (active) root.style.setProperty('--keyboard-height', '0px');
  }).then((h) => handles.push(h)).catch(() => {});

  return () => {
    active = false;
    root.style.setProperty('--keyboard-height', '0px');
    for (const h of handles) void h.remove().catch(() => {});
  };
}

/** Oculta a SplashScreen nativa após o primeiro render hidratado da app. */
export async function hideNativeSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 220 });
  } catch {
    // Silencioso se já estiver oculta.
  }
}

export async function hapticTap(kind: 'light' | 'medium' = 'light'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch {
    // Dispositivo sem motor háptico.
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Dispositivo sem motor háptico.
  }
}
