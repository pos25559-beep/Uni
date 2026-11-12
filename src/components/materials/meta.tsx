// Helpers de materiais: deteção de fornecedor a partir do URL, ícones e datas.
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  BookOpen, Cloud, FileSpreadsheet, FileText, Folder, GraduationCap, HardDrive, Image as ImageIcon,
  Link2, Presentation, Video, type LucideIcon,
} from 'lucide-react';
import type { Material, MaterialProvider } from '../../types';

/** Faz parse de um URL http(s); acrescenta https:// se o utilizador o escreveu sem esquema. */
export function parseWebUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** href seguro (só http/https) para links guardados; undefined se o URL for inválido. */
export function safeHref(raw: string): string | undefined {
  return parseWebUrl(raw)?.toString();
}

export function detectProvider(raw: string): MaterialProvider | null {
  const u = parseWebUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  if (host === 'notebooklm.google.com') return 'notebooklm';
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'gdrive';
  if (host === 'onedrive.live.com' || host === '1drv.ms' || host.endsWith('.sharepoint.com')) return 'onedrive';
  if (host === 'clip.fct.unl.pt' || host.startsWith('clip.')) return 'clip';
  return 'link';
}

const providerIcon: Record<MaterialProvider, LucideIcon> = {
  gdrive: HardDrive,
  onedrive: Cloud,
  notebooklm: BookOpen,
  clip: GraduationCap,
  link: Link2,
};

/** Ícone pelo tipo de ficheiro; se não for reconhecido, ícone do fornecedor. */
export function materialIcon(m: Pick<Material, 'provider' | 'mimeType'>): LucideIcon {
  const t = m.mimeType ?? '';
  if (t === 'application/vnd.google-apps.folder') return Folder;
  if (t.includes('pdf')) return FileText;
  if (t.includes('presentation') || t.includes('powerpoint') || t.includes('slides')) return Presentation;
  if (t.includes('spreadsheet') || t.includes('excel') || t.includes('sheet')) return FileSpreadsheet;
  if (t.includes('document') || t.includes('msword') || t.includes('word') || t.startsWith('text/')) return FileText;
  if (t.startsWith('image/')) return ImageIcon;
  if (t.startsWith('video/')) return Video;
  return providerIcon[m.provider];
}

/** "há 3 dias" ou '' se a data for inválida. */
export function relativeDate(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true, locale: pt }) : '';
}

export function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'd MMM yyyy', { locale: pt }) : '';
}
