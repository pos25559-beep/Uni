import { ArrowLeft, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { LEGAL_INFO } from '../lib/legal';
import { AnimatedPage } from '../components/motion/Primitives';
import AccountDeletionModal from '../components/settings/AccountDeletionModal';
import { UnipediaLogoMark } from '../components/brand/UnipediaMarks';
import { Badge, Button, Card } from '../components/ui';

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
    <AnimatedPage className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-medium text-fg hover:bg-surface-2"
        >
          <ArrowLeft size={14} />
          Voltar à Unipedia
        </Link>
        <div className="flex items-center gap-2">
          <UnipediaLogoMark size={26} />
          <span className="text-xs font-medium text-muted">
            Atualizado em <span className="tabular">{LEGAL_INFO.lastUpdated}</span>
          </span>
        </div>
      </div>

      <header className="space-y-2">
        <Badge tone="accent">Conformidade Europeia · RGPD &amp; Google Play</Badge>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </header>

      {children}

      <footer className="flex flex-wrap items-center gap-4 border-t border-line pt-4 text-xs text-muted">
        <Link to="/privacidade" className="hover:text-fg underline-offset-2 hover:underline">
          Política de Privacidade
        </Link>
        <Link to="/termos" className="hover:text-fg underline-offset-2 hover:underline">
          Termos de Utilização
        </Link>
        <Link to="/eliminar-conta" className="hover:text-fg underline-offset-2 hover:underline">
          Eliminar Conta e Dados
        </Link>
      </footer>
    </AnimatedPage>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Política de Privacidade (RGPD)"
      subtitle="Transparência total sobre como a Unipedia recolhe, armazena e protege os teus dados de estudo na União Europeia."
    >
      <Card title="1. Responsável pelo Tratamento">
        <div className="space-y-2 text-sm text-muted">
          <p>
            <strong className="text-fg">Entidade responsável:</strong> {LEGAL_INFO.controllerName} ({LEGAL_INFO.country}).
          </p>
          <p>
            <strong className="text-fg">Contacto para privacidade e RGPD:</strong>{' '}
            <a className="text-accent underline" href={`mailto:${LEGAL_INFO.contactEmail}`}>
              {LEGAL_INFO.contactEmail}
            </a>
          </p>
          <p>
            <strong className="text-fg">Idade mínima (Lei n.º 58/2019 — Portugal):</strong> {LEGAL_INFO.minimumAgePT} anos. Menores de {LEGAL_INFO.minimumAgePT} anos apenas podem usar contas sincronizadas com autorização dos encarregados de educação.
          </p>
        </div>
      </Card>

      <Card title="2. Dados Tratados e Finalidades">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>
            <strong className="text-fg">Modo Local (por omissão):</strong> cadeiras, notas, sessões de estudo, tarefas, horários, ficheiros guardados localmente e preferências permanecem exclusivamente no dispositivo (<code className="text-xs">localStorage</code> / WebView Android). Não há rastreadores publicitários nem telemetria oculta.
          </li>
          <li>
            <strong className="text-fg">Sincronização Cloud Opcional (Firebase Auth &amp; Firestore):</strong> caso escolhas iniciar sessão (Google ou Email/Palavra-passe), o identificador (<code className="text-xs">uid</code>), nome, email e os dados do teu semestre são sincronizados sob regras de isolamento estrito (<code className="text-xs">/users/{'{uid}'}</code>) para acederes entre telemóvel e computador.
          </li>
          <li>
            <strong className="text-fg">Inteligência Artificial Opcional (Google Gemini API — EU AI Act Art. 50.º):</strong> apenas quando ativas o consentimento explícito de IA e configuras a tua chave, o contexto de estudo que escolhes partilhar ou capturas do teu portal académico (OCR) são enviados diretamente à API Gemini para responder às tuas questões.
          </li>
          <li>
            <strong className="text-fg">Fontes Externas Só de Leitura (opcional):</strong> ligações Google Calendar, Google Drive, Gmail Académico (<code className="text-xs">gmail.readonly</code>) e Microsoft OneDrive são iniciadas unicamente por ti via OAuth oficial.
          </li>
        </ul>
      </Card>

      <Card title="3. Bases Legais e Transferências Internacionais">
        <div className="space-y-2 text-sm text-muted">
          <p>
            Tratamos os teus dados com base no <strong className="text-fg">consentimento explícito</strong> (RGPD Art. 6.º, n.º 1, alínea a) para Cloud, OAuth e Gemini IA, e na <strong className="text-fg">execução do serviço solicitado</strong> (alínea b) para funcionamento local da app.
          </p>
          <p>
            Serviços Google (Firebase / Gemini / Google OAuth) e Microsoft (OneDrive) operam ao abrigo do EU-U.S. Data Privacy Framework e Cláusulas Contratuais-Tipo aprovadas pela Comissão Europeia.
          </p>
        </div>
      </Card>

      <Card title="4. Os Teus Direitos (Portabilidade, Retificação e Esquecimento)">
        <div className="space-y-3 text-sm text-muted">
          <p>
            Ao abrigo dos artigos 15.º a 21.º do RGPD podes, a qualquer momento e sem custos:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-fg">Exportar e Importar tudo (Portabilidade Art. 20.º):</strong> em <Link to="/definicoes" className="text-accent underline">Definições → Dados</Link> descarregas um JSON completo.</li>
            <li><strong className="text-fg">Revogar consentimentos:</strong> desativa IA Gemini ou sincronização Cloud a qualquer momento nas Definições.</li>
            <li><strong className="text-fg">Eliminar conta e dados (Art. 17.º):</strong> usa o botão permanente na página <Link to="/eliminar-conta" className="text-accent underline">/eliminar-conta</Link> ou nas Definições.</li>
            <li>
              <strong className="text-fg">Reclamação:</strong> podes apresentar reclamação junto da{' '}
              <a
                href={LEGAL_INFO.supervisoryAuthority.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent underline"
              >
                {LEGAL_INFO.supervisoryAuthority.name}
                <ExternalLink size={12} />
              </a>.
            </li>
          </ul>
        </div>
      </Card>
    </LegalShell>
  );
}

export function TermsOfUsePage() {
  return (
    <LegalShell
      title="Termos de Utilização"
      subtitle="Condições simples e justas para utilizares a Unipedia na faculdade ou na escola."
    >
      <Card title="1. Âmbito Académico">
        <p className="text-sm text-muted leading-relaxed">
          A Unipedia é uma ferramenta de organização pessoal de estudo para estudantes do Ensino Superior e Ensino Secundário. Cálculos de médias, prioridades de testes e planos de 14 dias têm caráter estritamente orientador e não substituem regulamentos oficiais, pautas ou avisos da tua escola ou universidade.
        </p>
      </Card>

      <Card title="2. Transparência sobre Inteligência Artificial (EU AI Act)">
        <p className="text-sm text-muted leading-relaxed">
          O Tutor Semanal, o Assistente e o leitor de prints académicos utilizam modelos generativos Gemini quando ativados por ti. Resultados de IA podem conter imprecisões: confirma sempre datas de exames, fórmulas de avaliação e notas nas plataformas oficiais da instituição (ex.: CLIP, Fénix, Sigarra, Inovar).
        </p>
      </Card>

      <Card title="3. Catálogo Curricular Partilhado">
        <p className="text-sm text-muted leading-relaxed">
          Ao partilhares um plano curricular na coleção pública (<code className="text-xs">/curricula</code>), comprometes-te a enviar apenas estrutura pública de unidades curriculares (nome, código, ECTS e tópicos genéricos), sem dados pessoais de terceiros.
        </p>
      </Card>
    </LegalShell>
  );
}

export function DeleteAccountPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const user = auth.currentUser;

  return (
    <LegalShell
      title="Eliminar Conta e Dados (Unipedia)"
      subtitle="Fluxo oficial da Google Play Store e do RGPD (Direito ao Esquecimento) para remover integralmente a tua conta e dados associados."
    >
      <Card
        title="O que é eliminado?"
        action={<ShieldCheck size={18} className="text-ok" />}
      >
        <div className="space-y-3 text-sm text-muted">
          <p>
            Quando confirmas a eliminação na Unipedia, os seguintes dados são apagados de imediato e de forma irreversível:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Credencial e registo de autenticação no <strong className="text-fg">Firebase Authentication</strong>.</li>
            <li>Todos os documentos na cloud em <code className="text-xs">/users/{'{uid}'}</code> (perfil académico, cadeiras, avaliações, horários, sessões de estudo, tarefas, materiais, eventos e check-ins semanais).</li>
            <li>Dados locais (<code className="text-xs">localStorage</code> e <code className="text-xs">sessionStorage</code>) no dispositivo atual.</li>
          </ul>
          <p className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
            <strong className="text-fg">Estado atual neste dispositivo:</strong>{' '}
            {user ? `Sessão iniciada como ${user.email ?? user.uid}.` : 'Sem sessão Cloud iniciada (podes iniciar sessão em Definições ou limpar os dados locais abaixo).'}
          </p>
          <div className="pt-1 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setModalOpen(true)}>
              <Trash2 size={16} />
              {user ? 'Iniciar eliminação definitiva da conta' : 'Apagar dados locais deste dispositivo'}
            </Button>
            <a
              href={`mailto:${LEGAL_INFO.contactEmail}?subject=${encodeURIComponent('Pedido RGPD — Eliminação de Conta Unipedia')}`}
              className="inline-flex h-10 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium text-fg hover:border-muted/50"
            >
              Pedir eliminação por email
            </a>
          </div>
        </div>
      </Card>

      <AccountDeletionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </LegalShell>
  );
}
