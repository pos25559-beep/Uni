import type { BuddyMood } from '../components/brand/UnipediaMarks';

export type AppTabKey =
  | 'dashboard'
  | 'cadeiras'
  | 'calendario'
  | 'plano'
  | 'progresso'
  | 'materiais'
  | 'assistente'
  | 'definicoes';

export interface TabGuideSpec {
  key: AppTabKey;
  eyebrow: string;
  title: string;
  summary: string;
  emptySummary?: string;
  highlights: string[];
  mood: BuddyMood;
  tintClass: string;
}

export const TAB_GUIDES: Record<AppTabKey, TabGuideSpec> = {
  dashboard: {
    key: 'dashboard',
    eyebrow: 'Olá, eu sou o Uni · Aba Hoje',
    title: 'O teu resumo vivo do dia',
    summary:
      'Aqui juntas o que interessa hoje sem ruído: próximo bloco focado, entregas urgentes, tarefas Post-it e avisos das tuas cadeiras.',
    highlights: [
      'Toca no bloco de Foco de hoje para entrar em temporizador + recall ativo.',
      'Abre o Check-in Semanal quando te sentires atrasado ou pressionado para adaptar a carga.',
    ],
    mood: 'happy',
    tintClass: 'border-[#157F58]/25 bg-[#F4F9EE] dark:bg-[#192318]',
  },
  cadeiras: {
    key: 'cadeiras',
    eyebrow: 'Guia do Uni · Aba Cadeiras',
    title: 'O coração do teu semestre',
    emptySummary:
      'Ainda não há cadeiras aqui — se saltaste este passo na entrada ou começaste um semestre novo, escolhe uma das 3 formas rápidas abaixo: criar à mão, enviar uma foto do teu horário/agenda para eu ler, ou extrair direto do Google Calendar.',
    summary:
      'Cada pasta é muito mais do que o nome da disciplina: guarda o programa por confiança (1–5), aulas semanais, pesos de avaliação e ligações ao teu Drive ou Caderno.',
    highlights: [
      'Foto da agenda/horário: envio uma leitura visual e crio cadeiras e turnos num toque.',
      'Confiança 1–5 + último recall ditam quanto tempo o Plano dedica a cada tópico.',
    ],
    mood: 'curious',
    tintClass: 'border-[#E04F33]/25 bg-[#FFF7F3] dark:bg-[#291A17]',
  },
  calendario: {
    key: 'calendario',
    eyebrow: 'Guia do Uni · Aba Calendário',
    title: 'Aulas, exames e agenda num só sítio',
    summary:
      'Cruza o teu horário semanal de aulas com avaliações e eventos do Google Calendar. O Plano lê os teus dias mais cheios para não te marcar blocos impossíveis.',
    highlights: [
      'Se ligaste a Google Agenda, podes sincronizar eventos e extrair aulas/exames para Cadeiras.',
      'Carrega em «+ Novo» para adicionar testes manuais e prazos de entrega.',
    ],
    mood: 'calm',
    tintClass: 'border-[#2563EB]/20 bg-[#F3F8FF] dark:bg-[#162033]',
  },
  plano: {
    key: 'plano',
    eyebrow: 'Guia do Uni · Aba Plano',
    title: 'Não é só uma lista: aprende com ciência',
    summary:
      'O gerador combina blocos curtos adaptativos, Modo Teste (<10 dias) e Repetição Espaçada contínua (1 → 3 → 7 → 21 dias). No fim de cada sessão, fazes um mini-check de recall ativo.',
    highlights: [
      'Matéria com confiança 1–2 recebe blocos mais curtos (≤35 min) para não cansar em falso.',
      'Marca cada bloco concluído no temporizador para agendar automaticamente a próxima revisão.',
    ],
    mood: 'thinking',
    tintClass: 'border-[#D97706]/25 bg-[#FFFBEF] dark:bg-[#2B2311]',
  },
  progresso: {
    key: 'progresso',
    eyebrow: 'Guia do Uni · Aba Progresso',
    title: 'Onde estás forte e onde vale reforçar',
    summary:
      'Cruza horas realmente estudadas com o teu nível de confiança por cadeira e identifica logo a disciplina que precisa de atenção antes do próximo teste.',
    highlights: [
      'Cada sequência de dias e revisões de recall ativo desbloqueia novos visuais colecionáveis para mim (incluindo o Uni Vermelho!).',
    ],
    mood: 'celebrate',
    tintClass: 'border-[#157F58]/25 bg-[#F2FBF6] dark:bg-[#14251E]',
  },
  materiais: {
    key: 'materiais',
    eyebrow: 'Guia do Uni · Aba Materiais',
    title: 'Apontamentos e exames sempre à mão',
    summary:
      'Agrupa PDFs locais, pastas do Google Drive e cadernos do NotebookLM por cadeira — e marca os materiais prioritários para os poder consultar no Tutor.',
    highlights: [
      'Podes enviar sebentas ou testes antigos diretamente do dispositivo ou escolher do Drive.',
    ],
    mood: 'curious',
    tintClass: 'border-[#0891B2]/25 bg-[#F1FAFC] dark:bg-[#132429]',
  },
  assistente: {
    key: 'assistente',
    eyebrow: 'Guia do Uni · Uni Tutor',
    title: 'Explicações guiadas pelo teu caderno',
    summary:
      'Eu já conheço as tuas cadeiras, avaliações próximas e tópicos mais frágeis. Tens 15 mensagens diárias gratuitas incluídas no Uni Nativo — e, se precisares de estudo intensivo sem limite, podes ligar a tua chave gratuita do Google AI Studio.',
    highlights: [
      'Toca no contador diário no topo sempre que quiseres ver o guia de 1 minuto para pôr a tua chave Gemini.',
      'Alterna entre Amigo, Exigente ou Anti-Stress, e desbloqueia novas cores minhas na Vitrina do Uni.',
    ],
    mood: 'happy',
    tintClass: 'border-[#E04F33]/25 bg-[#FFF8F5] dark:bg-[#271B17]',
  },
  definicoes: {
    key: 'definicoes',
    eyebrow: 'Guia do Uni · Definições',
    title: 'O teu controlo de ligações e privacidade',
    summary:
      'Configura a tua chave pessoal Gemini (para passar das 15 msgs/dia a uso ilimitado), associa Google Drive/Agenda/Gmail e exporta backups dos teus dados locais a qualquer momento.',
    highlights: [
      'Na secção «Uni & Gemini», tens o botão passo-a-passo para gerar a chave gratuita no Google AI Studio.',
    ],
    mood: 'calm',
    tintClass: 'border-line bg-surface dark:bg-surface',
  },
};
