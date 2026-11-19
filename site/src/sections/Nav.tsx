import { UnipediaLogoMark } from '@app/components/brand/UnipediaLogo';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { APP_URL, LANGS, useCopy, useLang } from '../i18n';
import { SPRING } from '../ui';

function LangSwitch() {
  const lang = useLang();
  const { nav } = useCopy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${nav.language}: ${lang.label}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 font-mono text-xs font-semibold text-fg transition-colors hover:bg-surface-2"
      >
        {lang.short}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={SPRING}
            className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-[18px] border border-line bg-surface p-1.5 shadow-float"
          >
            {LANGS.map((l) => (
              <li key={l.code} role="none">
                <a
                  role="menuitem"
                  href={l.path}
                  hrefLang={l.code}
                  lang={l.code}
                  aria-current={l.code === lang.code ? 'true' : undefined}
                  className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-sm ${
                    l.code === lang.code ? 'bg-accent-soft font-semibold text-fg' : 'text-fg hover:bg-surface-2'
                  }`}
                >
                  {l.label}
                  <span className="font-mono text-xs text-muted">{l.short}</span>
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Nav() {
  const { nav } = useCopy();
  const lang = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const links = [
    { href: '#como-funciona', label: nav.how },
    { href: '#uni', label: nav.uni },
    { href: '#dados', label: nav.privacy },
    { href: '#perguntas', label: nav.faq },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled || menu ? 'bg-bg/85 shadow-[0_1px_0_var(--line)] backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-[72px] max-w-6xl items-center gap-2 px-4 sm:px-6">
        <a href={lang.path} aria-label={nav.home} className="mr-auto flex min-h-11 items-center gap-2.5 rounded-xl">
          <UnipediaLogoMark size={34} />
          <span className="font-display text-lg font-bold tracking-tight">Unipedia</span>
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="flex h-11 items-center rounded-full px-3.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <LangSwitch />
        <a
          href={APP_URL}
          className="hidden h-11 items-center rounded-full bg-ink-cta px-5 text-sm font-semibold text-ink-cta-fg transition-transform hover:-translate-y-px active:scale-[0.98] sm:flex"
        >
          {nav.open}
        </a>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full hover:bg-surface-2 md:hidden"
          aria-label={nav.menu}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <path
              d={menu ? 'M5 5l12 12M17 5L5 17' : 'M3.5 7h15M3.5 15h15'}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </nav>
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <ul className="space-y-1 px-4 py-3">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setMenu(false)} className="flex min-h-12 items-center rounded-xl px-3 text-base font-medium hover:bg-surface-2">
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="pt-2">
                <a href={APP_URL} className="flex min-h-12 items-center justify-center rounded-full bg-ink-cta text-base font-semibold text-ink-cta-fg">
                  {nav.open}
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
