import { UnipediaLogoMark } from '@app/components/brand/UnipediaLogo';
import { APP_URL, LANGS, useCopy } from '../i18n';
import { pagePath, useRoute } from '../routes';
import { Reveal, SectionHead, UniFace } from '../ui';

export function Faq() {
  const { faq } = useCopy();
  return (
    <section id="perguntas" aria-labelledby="faq-title" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead id="faq-title" kicker={faq.kicker} title={faq.title} />
        <div className="divide-y divide-line border-y border-line">
          {faq.items.map((it) => (
            <details key={it.q} className="group">
              <summary className="flex min-h-16 items-center justify-between gap-4 py-4 text-lg font-semibold">
                {it.q}
                <span aria-hidden="true" className="faq-chevron grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-lg transition-transform">
                  +
                </span>
              </summary>
              <p className="pb-5 pr-12 text-base leading-relaxed text-muted">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const { cta } = useCopy();
  return (
    <section aria-labelledby="cta-title" className="px-4 py-20 sm:px-6 sm:py-24">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink-cta px-6 py-16 text-center text-ink-cta-fg sm:px-12 sm:py-20">
        <UniFace size={84} className="mx-auto" />
        <h2 id="cta-title" className="font-display mx-auto mt-6 max-w-3xl text-[clamp(2.2rem,6vw,4rem)] font-extrabold leading-[1]">
          {cta.title} <em className="font-serif font-normal italic text-pastel-butter dark:text-accent">{cta.titleEm}</em>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg opacity-80">{cta.body}</p>
        <a
          href={APP_URL}
          className="mt-8 inline-flex h-13 items-center gap-2 rounded-full bg-ink-cta-fg px-8 text-base font-semibold text-ink-cta transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
        >
          {cta.button} <span aria-hidden="true">→</span>
        </a>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const { footer } = useCopy();
  const { lang, page } = useRoute();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <UnipediaLogoMark size={30} />
            <span className="font-display text-lg font-bold">Unipedia</span>
          </div>
          <p className="mt-3 font-serif text-lg italic text-muted">{footer.tagline}</p>
          <p className="mt-1 text-sm text-muted">{footer.made}</p>
        </div>
        <nav aria-label="Unipedia" className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
          {[
            { href: `${APP_URL}/privacidade`, label: footer.privacy },
            { href: `${APP_URL}/termos`, label: footer.terms },
            { href: `${APP_URL}/eliminar-conta`, label: footer.delete },
          ].map((l) => (
            <a key={l.href} href={l.href} className="flex min-h-11 items-center rounded-lg px-2 text-muted hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <ul className="flex flex-wrap gap-1 text-sm">
          {LANGS.map((l) => (
            <li key={l.code}>
              <a
                href={pagePath(l, page)}
                hrefLang={l.code}
                lang={l.code}
                aria-current={l.code === lang.code ? 'true' : undefined}
                className={`flex min-h-11 items-center rounded-lg px-2 ${l.code === lang.code ? 'font-semibold text-fg' : 'text-muted hover:text-fg'}`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 font-mono text-xs text-muted sm:px-6">{footer.rights}</p>
    </footer>
  );
}
