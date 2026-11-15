import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useHubUiStore } from '../store/useHubUiStore';
import {
  buildSampleUniNotification,
  planSmartNotifications,
  resolveNotificationPrefs,
  type NotificationPlannerInput,
  type ScheduledUniNotification,
} from './uniNotifications';

const CHANNEL_ID = 'uni-study';
const FIRED_STORAGE_KEY = 'unipedia_notif_fired_v1';
const MANAGED_PREFIX_MIN_ID = 1000;
const webTimers: number[] = [];
let webNavigateHandler: ((route: string) => void) | null = null;

function clearWebTimers() {
  while (webTimers.length > 0) {
    const id = webTimers.pop();
    if (id !== undefined) window.clearTimeout(id);
  }
}

function getFiredSet(): Record<string, number> {
  try {
    const raw = localStorage.getItem(FIRED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
    const pruned: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && ts > cutoff) pruned[k] = ts;
    }
    return pruned;
  } catch {
    return {};
  }
}

function markFired(key: string) {
  try {
    const map = getFiredSet();
    map[key] = Date.now();
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // noop
  }
}

export async function getUniNotificationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.checkPermissions();
      if (res.display === 'granted') return 'granted';
      if (res.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

export async function requestUniNotificationPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result === 'granted' ? 'granted' : 'denied';
}

async function ensureAndroidChannel() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Lembretes do Uni',
      description: 'Sequência diária, revisões espaçadas, testes e aulas',
      importance: 4,
      visibility: 1,
    });
  } catch {
    // iOS / web fallback
  }
}

async function dispatchWebNotification(item: ScheduledUniNotification): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const options: NotificationOptions = {
    body: item.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: item.key,
    data: { route: item.route },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.showNotification) {
        await reg.showNotification(item.title, options);
        return true;
      }
    }
  } catch {
    // fallback para Notification direta abaixo
  }

  try {
    const n = new Notification(item.title, options);
    n.onclick = () => {
      window.focus();
      if (item.route) {
        if (webNavigateHandler) webNavigateHandler(item.route);
        else window.location.assign(item.route);
      }
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Sincroniza o plano de notificações inteligentes com Android LocalNotifications ou timers Web/PWA.
 * Cancela automaticamente agendamentos obsoletos (ex.: streak depois de estudar hoje).
 */
export async function syncScheduledUniNotifications(
  input: NotificationPlannerInput,
): Promise<ScheduledUniNotification[]> {
  const prefs = resolveNotificationPrefs(input.settings.notifications);
  const plan = prefs.enabled ? planSmartNotifications(input) : [];

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      const pending = await LocalNotifications.getPending();
      const managedToCancel = pending.notifications.filter((n) => n.id >= MANAGED_PREFIX_MIN_ID);
      if (managedToCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: managedToCancel.map((n) => ({ id: n.id })) });
      }
      if (!prefs.enabled || perm.display !== 'granted' || plan.length === 0) {
        return plan;
      }
      await ensureAndroidChannel();
      await LocalNotifications.schedule({
        notifications: plan.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          schedule: { at: new Date(item.fireAt), allowWhileIdle: true },
          channelId: CHANNEL_ID,
          extra: { route: item.route, kind: item.kind },
        })),
      });
    } catch {
      // evita crash se permissão foi revogada
    }
    return plan;
  }

  // Web / PWA: agenda em memória avisos dentro das próximas 12h
  clearWebTimers();
  if (!prefs.enabled || typeof window === 'undefined' || !('Notification' in window)) {
    return plan;
  }
  if (Notification.permission !== 'granted') return plan;

  const fired = getFiredSet();
  const nowMs = Date.now();
  const maxDelayMs = 12 * 3600 * 1000;

  for (const item of plan) {
    if (fired[item.key]) continue;
    const delay = new Date(item.fireAt).getTime() - nowMs;
    if (delay < 1000 || delay > maxDelayMs) continue;
    const timer = window.setTimeout(() => {
      if (useHubUiStore.getState().focusShieldRunning) return;
      markFired(item.key);
      void dispatchWebNotification(item);
    }, delay);
    webTimers.push(timer);
  }

  return plan;
}

/** Dispara um exemplo realista imediato (OS se permitido, caso contrário fallback in-app). */
export async function sendTestUniNotification(
  input: NotificationPlannerInput,
): Promise<{ delivered: 'native' | 'web' | 'inapp'; notification: ScheduledUniNotification }> {
  const sample = buildSampleUniNotification(input);

  if (Capacitor.isNativePlatform()) {
    const perm = await requestUniNotificationPermission();
    if (perm === 'granted') {
      await ensureAndroidChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: sample.id,
            title: sample.title,
            body: sample.body,
            schedule: { at: new Date(Date.now() + 1200) },
            channelId: CHANNEL_ID,
            extra: { route: sample.route, kind: sample.kind },
          },
        ],
      });
      return { delivered: 'native', notification: sample };
    }
    return { delivered: 'inapp', notification: sample };
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    const perm =
      Notification.permission === 'granted' ? 'granted' : await requestUniNotificationPermission();
    if (perm === 'granted' && (await dispatchWebNotification(sample))) {
      return { delivered: 'web', notification: sample };
    }
  }

  return { delivered: 'inapp', notification: sample };
}

/** Regista listener para abrir a rota correta ao tocar numa notificação (nativa ou Web). */
export function initNotificationListeners(onNavigate: (route: string) => void): () => void {
  webNavigateHandler = onNavigate;
  if (!Capacitor.isNativePlatform()) {
    return () => {
      if (webNavigateHandler === onNavigate) webNavigateHandler = null;
      clearWebTimers();
    };
  }
  let active = true;
  let removeFn: (() => Promise<void>) | undefined;

  void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    if (!active) return;
    const route = (event.notification.extra as { route?: string } | undefined)?.route;
    if (route) onNavigate(route);
  }).then((handle) => {
    if (active) removeFn = () => handle.remove();
    else void handle.remove();
  });

  return () => {
    active = false;
    if (webNavigateHandler === onNavigate) webNavigateHandler = null;
    clearWebTimers();
    if (removeFn) void removeFn();
  };
}
