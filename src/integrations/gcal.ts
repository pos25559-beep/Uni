// Sincronização da Google Agenda (só leitura) para os eventos da app.
import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import { useStore } from '../store/useStore';
import type { CalendarEvent } from '../types';
import { googleFetch } from './googleAuth';

interface GoogleEventTime { dateTime?: string; date?: string }
interface GoogleEvent {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
}
interface GoogleEventsPage { items?: GoogleEvent[]; nextPageToken?: string }

const MAX_PAGES = 4;
const localIso = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss");

function mapEvent(item: GoogleEvent): CalendarEvent | null {
  if (!item.id || item.status === 'cancelled') return null;
  const startRaw = item.start?.dateTime ?? item.start?.date;
  if (!startRaw) return null;
  const allDay = !item.start?.dateTime;
  const endRaw = item.end?.dateTime ?? item.end?.date ?? startRaw;

  const start = allDay ? `${startRaw}T00:00:00` : localIso(new Date(startRaw));
  const end = allDay ? `${endRaw}T00:00:00` : localIso(new Date(endRaw));

  const event: CalendarEvent = {
    id: `google:${item.id}`,
    title: item.summary ?? '(sem título)',
    start,
    end,
    source: 'google',
  };
  if (allDay) event.allDay = true;
  if (item.location) event.location = item.location;
  return event;
}

/**
 * Importa os eventos do calendário principal entre o início e o fim do semestre.
 * Substitui os eventos anteriormente importados da Google. Devolve o número de eventos.
 */
export async function syncGoogleCalendar(): Promise<number> {
  const { settings, replaceSource, setIntegration } = useStore.getState();
  try {
    const params = new URLSearchParams({
      timeMin: startOfDay(parseISO(settings.semesterStart)).toISOString(),
      timeMax: endOfDay(parseISO(settings.semesterEnd)).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const items: CalendarEvent[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams(params);
      if (pageToken) query.set('pageToken', pageToken);
      const data = await googleFetch<GoogleEventsPage>(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query.toString()}`,
      );
      for (const raw of data.items ?? []) {
        const ev = mapEvent(raw);
        if (ev) items.push(ev);
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    replaceSource('events', 'google', items);
    setIntegration('google', { connected: true, lastSync: new Date().toISOString(), error: undefined });
    return items.length;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao sincronizar a Google Agenda.';
    setIntegration('google', { error: message });
    throw e instanceof Error ? e : new Error(message);
  }
}
