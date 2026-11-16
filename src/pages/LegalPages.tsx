import { format, parseISO } from 'date-fns';
import { ChevronDown, Cloud, ExternalLink, ShieldCheck, Smartphone, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnimatedPage, StickerBadge } from '../components/motion/Primitives';
import AccountDeletionModal from '../components/settings/AccountDeletionModal';
import { Button, Card, SubpageHeader } from '../components/ui';
import { appDateLocale, fullDatePattern } from '../lib/dateLocale';
import { cx } from '../lib/uiHelpers';
import { auth } from '../lib/firebase';
import { LEGAL_INFO } from '../lib/legal';

/** Item de secção: [rótulo em destaque, texto]. Rótulo vazio = só texto. */
type LegalItem = [string, string];
interface PrivacySection {
  title: string;
  items?: LegalItem[];
  intro?: string;
}
interface TermsSection {
  title: string;
  body: string;
}

const LEGAL_VARS = {
  controller: LEGAL_INFO.controllerName,
  country: LEGAL_INFO.country,
  email: LEGAL_INFO.contactEmail,
};

function useLegal() {
  const { t } = useTranslation('legal');
  return t;
}

function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const t = useLegal();
  const date = format(parseISO(LEGAL_INFO.lastUpdated), fullDatePattern(), { locale: appDateLocale });
  const note = t('common.translationNote');
  return (
    <AnimatedPage className="mx-auto max-w-2xl space-y-5 pb-10">
      <SubpageHeader title={title} subtitle={t('common.updated', { date })} backTo="/definicoes" />
      <p className="text-sm text-muted">{subtitle}</p>
      {note && <p className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-xs text-muted">{note}</p>}

      {children}

      <footer className="flex flex-wrap items-center gap-4 border-t border-line pt-4 text-xs text-muted">
        <Link to="/privacidade" className="inline-flex min-h-11 items-center hover:text-fg underline-offset-2 hover:underline">
          {t('common.nav.privacy')}
        </Link>
        <Link to="/termos" className="inline-flex min-h-11 items-center hover:text-fg underline-offset-2 hover:underline">
          {t('common.nav.terms')}
        </Link>
        <Link to="/eliminar-conta" className="inline-flex min-h-11 items-center hover:text-fg underline-offset-2 hover:underline">
          {t('common.nav.delete')}
        </Link>
      </footer>
    </AnimatedPage>
  );
}

function LegalAccordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-display text-sm font-bold text-fg hover:bg-surface-2/50"
      >
        <span>{title}</span>
        <ChevronDown
          size={17}
          className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="border-t border-line px-4 py-3.5 text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

function ItemList({ items }: { items: LegalItem[] }) {
  if (items.length === 1 && !items[0][0]) return <p>{items[0][1]}</p>;
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map(([label, text], i) => (
        <li key={i}>
          {label && <strong className="text-fg">{label}</strong>} {text}
        </li>
      ))}
    </ul>
  );
}

export function PrivacyPolicyPage() {
  const t = useLegal();
  const cards = t('privacy.cards', { returnObjects: true }) as Array<{ title: string; body: string }>;
  const sections = t('privacy.sections', { returnObjects: true, ...LEGAL_VARS }) as PrivacySection[];
  const cardIcons = [
    <Smartphone key="d" size={18} className="text-[#157F58] dark:text-[#4ADE80]" />,
    <Cloud key="c" size={18} className="text-[#1D5FAD] dark:text-[#93C5FD]" />,
    <Sparkles key="a" size={18} className="text-[#E04F33] dark:text-[#FF7A59]" />,
  ];

  return (
    <LegalShell title={t('privacy.title')} subtitle={t('privacy.subtitle')}>
      <div className="space-y-4 rounded-3xl bg-[#BCEEE0] p-5 text-[#141312] dark:bg-[#17312B] dark:text-[#FAF6EC]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StickerBadge tone="butter" tilt={-2}>
            {t('privacy.summaryBadge')}
          </StickerBadge>
          <span className="text-xs font-semibold opacity-75">{t('privacy.laws')}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((card, i) => (
            <div key={card.title} className="rounded-2xl bg-white/75 p-3.5 dark:bg-black/25">
              {cardIcons[i]}
              <p className="mt-2 font-display text-sm font-bold">{card.title}</p>
              <p className="mt-1 text-xs opacity-80">{card.body}</p>
            </div>
          ))}
        </div>
      </div>

      {sections.map((section, i) => (
        <LegalAccordion key={section.title} title={section.title} defaultOpen={i === 0}>
          {section.items && <ItemList items={section.items} />}
          {section.intro && (
            <div className="space-y-2">
              <p>{section.intro}</p>
              <ul className="space-y-1.5">
                {LEGAL_INFO.authorities.map((a) => (
                  <li key={a.id}>
                    <span className="text-fg">{t(`privacy.authorities.${a.id}`)}:</span>{' '}
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-accent-ink underline"
                    >
                      {a.name}
                      <ExternalLink size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </LegalAccordion>
      ))}
    </LegalShell>
  );
}

export function TermsOfUsePage() {
  const t = useLegal();
  const sections = t('terms.sections', { returnObjects: true, ...LEGAL_VARS }) as TermsSection[];
  return (
    <LegalShell title={t('terms.title')} subtitle={t('terms.subtitle')}>
      {sections.map((section, i) => (
        <LegalAccordion key={section.title} title={section.title} defaultOpen={i === 0}>
          {section.body}
        </LegalAccordion>
      ))}
    </LegalShell>
  );
}

export function DeleteAccountPage() {
  const t = useLegal();
  const [modalOpen, setModalOpen] = useState(false);
  const user = auth.currentUser;
  const removed = t('delete.removed', { returnObjects: true }) as string[];

  return (
    <LegalShell title={t('delete.title')} subtitle={t('delete.subtitle')}>
      <Card title={t('delete.removedTitle')} action={<ShieldCheck size={18} className="text-ok" />}>
        <div className="space-y-3 text-sm text-muted">
          <ul className="list-disc space-y-1.5 pl-5">
            {removed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-xs">
            <strong className="text-fg">{t('delete.status')}</strong>{' '}
            {user ? t('delete.signedIn', { email: user.email ?? t('delete.activeAccount') }) : t('delete.offline')}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="danger" onClick={() => setModalOpen(true)}>
              <Trash2 size={16} />
              {user ? t('delete.deleteAccount') : t('delete.deleteLocal')}
            </Button>
            <a
              href={`mailto:${LEGAL_INFO.contactEmail}?subject=${encodeURIComponent(t('delete.emailSubject'))}`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg hover:bg-surface-2"
            >
              {t('delete.byEmail')}
            </a>
          </div>
        </div>
      </Card>

      <AccountDeletionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </LegalShell>
  );
}
