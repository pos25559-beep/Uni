import { ChevronDown, Cloud, ExternalLink, ShieldCheck, Smartphone, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedPage, StickerBadge } from '../components/motion/Primitives';
import AccountDeletionModal from '../components/settings/AccountDeletionModal';
import { Button, Card, SubpageHeader, cx } from '../components/ui';
import { auth } from '../lib/firebase';
import { LEGAL_INFO } from '../lib/legal';

function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatedPage className="mx-auto max-w-2xl space-y-5 pb-10">
      <SubpageHeader title={title} subtitle={`Atualizado em ${LEGAL_INFO.lastUpdated}`} backTo="/definicoes" />
      <p className="text-sm text-muted">{subtitle}</p>

      {children}

      <footer className="flex flex-wrap items-center gap-4 border-t border-line pt-4 text-xs text-muted">
        <Link to="/privacidade" className="hover:text-fg underline-offset-2 hover:underline">
          Privacidade
        </Link>
        <Link to="/termos" className="hover:text-fg underline-offset-2 hover:underline">
          Termos
        </Link>
        <Link to="/eliminar-conta" className="hover:text-fg underline-offset-2 hover:underline">
          Eliminar conta
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
    <div className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-card">
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

export function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Política de Privacidade"
      subtitle="Explicação direta sobre o que fica contigo e o que é partilhado — sem letra pequena."
    >
      {/* Resumo visual em 30 segundos */}
      <div className="space-y-4 rounded-[24px] bg-[#BCEEE0] p-5 text-[#141312] dark:bg-[#17312B] dark:text-[#FAF6EC]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StickerBadge tone="butter" tilt={-2}>
            A tua privacidade em 30 segundos
          </StickerBadge>
          <span className="text-xs font-semibold opacity-75">RGPD · UE</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] bg-white/75 p-3.5 dark:bg-black/25">
            <Smartphone size={18} className="text-[#157F58] dark:text-[#4ADE80]" />
            <p className="mt-2 font-display text-sm font-bold">No teu telemóvel</p>
            <p className="mt-1 text-xs opacity-80">
              Cadeiras, notas, tarefas e PDFs ficam guardados localmente por defeito. Zero publicidade.
            </p>
          </div>
          <div className="rounded-[18px] bg-white/75 p-3.5 dark:bg-black/25">
            <Cloud size={18} className="text-[#1D5FAD] dark:text-[#93C5FD]" />
            <p className="mt-2 font-display text-sm font-bold">Na nuvem só se quiseres</p>
            <p className="mt-1 text-xs opacity-80">
              Só sincronizamos se criares conta em /entrar. Podes usar tudo sem conta.
            </p>
          </div>
          <div className="rounded-[18px] bg-white/75 p-3.5 dark:bg-black/25">
            <Sparkles size={18} className="text-[#E04F33] dark:text-[#FF7A59]" />
            <p className="mt-2 font-display text-sm font-bold">Tutor IA transparente</p>
            <p className="mt-1 text-xs opacity-80">
              Só envia resumos ou prints quando ativas o consentimento e fazes uma pergunta.
            </p>
          </div>
        </div>
      </div>

      <LegalAccordion title="1. Quem gere a app e idade mínima" defaultOpen>
        <div className="space-y-2">
          <p>
            <strong className="text-fg">Responsável:</strong> {LEGAL_INFO.controllerName} ({LEGAL_INFO.country}) ·{' '}
            <a className="font-semibold text-accent underline" href={`mailto:${LEGAL_INFO.contactEmail}`}>
              {LEGAL_INFO.contactEmail}
            </a>
          </p>
          <p>
            <strong className="text-fg">Idade mínima em Portugal:</strong> pelo menos{' '}
            <strong className="text-fg">{LEGAL_INFO.minimumAgePT} anos</strong> (ou autorização do encarregado de educação, nos termos do RGPD e da Lei n.º 58/2019).
          </p>
        </div>
      </LegalAccordion>

      <LegalAccordion title="2. Os teus direitos (Exportar, Revogar, Eliminar)">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-fg">Exportar tudo:</strong> em{' '}
            <Link to="/definicoes" className="font-semibold text-accent underline">
              Definições → Privacidade &amp; Dados
            </Link>{' '}
            descarregas uma cópia JSON completa a qualquer momento.
          </li>
          <li>
            <strong className="text-fg">Desligar Tutor IA ou Nuvem:</strong> podes revogar qualquer consentimento com um toque nas Definições.
          </li>
          <li>
            <strong className="text-fg">Apagar conta para sempre:</strong> usa o portal{' '}
            <Link to="/eliminar-conta" className="font-semibold text-accent underline">
              Eliminar conta
            </Link>.
          </li>
          <li>
            <strong className="text-fg">Autoridade de controlo:</strong>{' '}
            <a
              href={LEGAL_INFO.supervisoryAuthority.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-accent underline"
            >
              {LEGAL_INFO.supervisoryAuthority.name}
              <ExternalLink size={12} />
            </a>
          </li>
        </ul>
      </LegalAccordion>

      <LegalAccordion title="3. Detalhes técnicos e legais">
        <div className="space-y-2 text-xs leading-relaxed">
          <p>
            <strong className="text-fg">Bases legais (RGPD Art. 6.º):</strong> execução local do serviço solicitado (alínea b) e consentimento explícito para sincronização Cloud (Firebase), OAuth Google/OneDrive (só leitura) e Google Gemini IA (alínea a + EU AI Act Art. 50.º).
          </p>
          <p>
            Serviços Google (Firebase / Gemini / Google OAuth) e Microsoft operam sob o EU-U.S. Data Privacy Framework e Cláusulas Contratuais-Tipo.
          </p>
        </div>
      </LegalAccordion>
    </LegalShell>
  );
}

export function TermsOfUsePage() {
  return (
    <LegalShell
      title="Termos de Utilização"
      subtitle="Regras claras e justas para usares a Unipedia nos teus estudos."
    >
      <LegalAccordion title="1. Apoio ao estudo (caráter orientador)" defaultOpen>
        A Unipedia ajuda-te a organizar horários, tarefas, apontamentos e metas. Médias, planos e alertas de teste são orientadores: confirma sempre prazos, salas e regulamentos oficiais na tua escola ou universidade.
      </LegalAccordion>

      <LegalAccordion title="2. Uso de Inteligência Artificial (Tutor)">
        O Tutor utiliza modelos Gemini apenas com a tua chave e consentimento ativo. Respostas de IA podem falhar em cálculos ou datas — valida sempre com o programa da cadeira.
      </LegalAccordion>

      <LegalAccordion title="3. Planos curriculares partilhados">
        Caso partilhes a estrutura de um curso no catálogo comunitário, comprometes-te a enviar apenas informação pública das cadeiras (nome, código, ECTS e tópicos gerais), sem dados pessoais de terceiros.
      </LegalAccordion>
    </LegalShell>
  );
}

export function DeleteAccountPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const user = auth.currentUser;

  return (
    <LegalShell
      title="Eliminar Conta e Dados"
      subtitle="Apaga definitivamente os teus dados deste dispositivo e da nuvem (Direito ao Esquecimento · RGPD Art. 17.º)."
    >
      <Card
        title="O que é removido"
        action={<ShieldCheck size={18} className="text-ok" />}
      >
        <div className="space-y-3 text-sm text-muted">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Credencial de autenticação na conta Unipedia (se tiveres sessão iniciada).</li>
            <li>Todos os dados guardados na nuvem e neste telemóvel (cadeiras, notas, tarefas, materiais locais e definições).</li>
          </ul>
          <p className="rounded-[16px] bg-surface-2 px-3.5 py-2.5 text-xs">
            <strong className="text-fg">Estado atual:</strong>{' '}
            {user ? `Sessão iniciada (${user.email ?? 'conta ativa'}).` : 'Modo offline neste dispositivo (sem conta Cloud).'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="danger" onClick={() => setModalOpen(true)}>
              <Trash2 size={16} />
              {user ? 'Eliminar conta definitivamente' : 'Apagar dados deste dispositivo'}
            </Button>
            <a
              href={`mailto:${LEGAL_INFO.contactEmail}?subject=${encodeURIComponent('Pedido RGPD — Eliminação de Conta Unipedia')}`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg hover:bg-surface-2"
            >
              Pedir por email
            </a>
          </div>
        </div>
      </Card>

      <AccountDeletionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </LegalShell>
  );
}
