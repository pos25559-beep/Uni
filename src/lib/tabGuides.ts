import type { BuddyMood } from '../components/brand/UnipediaMarks';
import type { AppLanguage } from '../types';
import { normalizeAppLanguage } from './grading';

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
      'Escolhe turno preferido (manhã, tarde ou noite), duração (25m Pomodoro até 75m) e cadeiras a reforçar em «Gerar plano».',
      'Matéria com confiança 1–2 recebe blocos mais curtos (≤35 min) para não cansar em falso.',
      'Marca cada bloco concluído no temporizador para agendar automaticamente a próxima revisão e dar energia ao Uni.',
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
    title: 'Pastas automáticas, exames e base para o Tutor',
    summary:
      'Agrupa PDFs locais, pastas do Google Drive (ex.: Semestre 1/Cálculo/, Física/) e cadernos externos por cadeira — mesmo que o nome do PDF não tenha a sigla da cadeira.',
    highlights: [
      'Varredura Drive / HD: cria pastas com a sigla ou nome da cadeira e cola o link da pasta mãe (ex.: Semestre 1) em «Pasta raiz» para acelerar o Google Drive.',
      'Marca materiais prioritários como «Fixado»: o Tutor lê automaticamente até 3 PDFs/Docs reais (ou até 12 com chave pessoal Gemini).',
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

type LocalizedTabGuideCopy = Pick<TabGuideSpec, 'eyebrow' | 'title' | 'summary' | 'emptySummary' | 'highlights'>;

const TAB_GUIDE_OVERRIDES: Record<'pt-BR' | 'es' | 'en', Record<AppTabKey, LocalizedTabGuideCopy>> = {
  'pt-BR': {
    dashboard: {
      eyebrow: 'Oi, eu sou o Uni · Aba Hoje',
      title: 'Seu resumo vivo do dia',
      summary:
        'Aqui você reúne o que importa hoje sem ruído: próximo bloco de foco, entregas urgentes, tarefas Post-it e avisos das suas disciplinas.',
      highlights: [
        'Toque no bloco de Foco de hoje para entrar no temporizador + recall ativo.',
        'Abra o Check-in Semanal quando se sentir atrasado ou pressionado para adaptar a carga.',
      ],
    },
    cadeiras: {
      eyebrow: 'Guia do Uni · Aba Disciplinas',
      title: 'O coração do seu semestre',
      emptySummary:
        'Ainda não há disciplinas aqui — escolha uma das formas rápidas abaixo: criar manualmente, enviar uma foto do seu horário para eu ler ou importar direto do Google Agenda.',
      summary:
        'Cada pasta guarda a ementa por confiança (1–5), aulas semanais, pesos de avaliação e links do Drive ou Caderno.',
      highlights: [
        'Foto do horário: faço a leitura visual e crio disciplinas e turmas em um toque.',
        'Confiança 1–5 + último recall definem quanto tempo o Plano dedica a cada tópico.',
      ],
    },
    calendario: {
      eyebrow: 'Guia do Uni · Aba Calendário',
      title: 'Aulas, provas e agenda em um só lugar',
      summary:
        'Cruza seu horário semanal de aulas com avaliações e eventos do Google Agenda. O Plano evita marcar blocos nos horários ocupados.',
      highlights: [
        'Se conectou o Google Agenda, sincronize eventos e extraia aulas e provas para Disciplinas.',
        'Clique em «+ Novo» para adicionar provas manuais e prazos de entrega.',
      ],
    },
    plano: {
      eyebrow: 'Guia do Uni · Aba Plano',
      title: 'Não é só uma lista: aprenda com ciência',
      summary:
        'O gerador combina blocos curtos adaptativos, Modo Prova (<10 dias) e Repetição Espaçada contínua (1 → 3 → 7 → 21 dias). No fim de cada sessão, você faz um mini recall ativo.',
      highlights: [
        'Escolha turno preferido, duração (25m a 75m) e disciplinas para reforçar em «Gerar plano».',
        'Conteúdo com confiança 1–2 recebe blocos mais curtos (≤35 min) para não cansar em falso.',
        'Conclua cada bloco no temporizador para agendar a próxima revisão e dar energia ao Uni.',
      ],
    },
    progresso: {
      eyebrow: 'Guia do Uni · Aba Progresso',
      title: 'Onde você está forte e onde vale reforçar',
      summary:
        'Cruza horas realmente estudadas com seu nível de confiança por disciplina e mostra o que precisa de atenção antes da próxima prova.',
      highlights: [
        'Cada sequência de dias e revisões de recall ativo desbloqueia novos visuais colecionáveis para o Uni.',
      ],
    },
    materiais: {
      eyebrow: 'Guia do Uni · Aba Materiais',
      title: 'Pastas automáticas, provas e base para o Tutor',
      summary:
        'Agrupa PDFs locais, pastas do Google Drive e cadernos externos por disciplina — mesmo quando o nome do arquivo não traz a sigla.',
      highlights: [
        'Varredura Drive / PC: crie pastas com a sigla ou nome da disciplina e vincule a pasta raiz.',
        'Marque materiais prioritários como «Fixado»: o Tutor lê automaticamente seus PDFs e anotações.',
      ],
    },
    assistente: {
      eyebrow: 'Guia do Uni · Uni Tutor',
      title: 'Explicações guiadas pelo seu caderno',
      summary:
        'Eu já conheço suas disciplinas, próximas provas e tópicos mais frágeis. Você tem mensagens diárias incluídas no Uni Nativo — e pode conectar sua chave gratuita do Google AI Studio para ampliar o uso.',
      highlights: [
        'Toque no contador diário no topo sempre que quiser ver o guia de 1 minuto para adicionar sua chave Gemini.',
        'Alterne entre Parceiro, Direto, Calmo, Curioso ou Treinador conforme o seu momento.',
      ],
    },
    definicoes: {
      eyebrow: 'Guia do Uni · Configurações',
      title: 'Seu controle de conexões e privacidade',
      summary:
        'Configure sua chave pessoal Gemini, conecte Google Drive/Agenda/Gmail, escolha o idioma e exporte backups dos seus dados locais quando quiser.',
      highlights: [
        'Na seção «Uni · Tutor IA», você encontra o passo a passo para gerar a chave gratuita no Google AI Studio.',
      ],
    },
  },
  es: {
    dashboard: {
      eyebrow: 'Hola, soy Uni · Pestaña Hoy',
      title: 'Tu resumen vivo del día',
      summary:
        'Aquí reúnes lo importante de hoy sin ruido: próximo bloque de estudio, entregas urgentes, tareas rápidas y avisos de tus asignaturas.',
      highlights: [
        'Toca el bloque de Foco de hoy para abrir el temporizador + recuerdo activo.',
        'Abre el Check-in Semanal si te sientes atrasado o presionado para ajustar la carga.',
      ],
    },
    cadeiras: {
      eyebrow: 'Guía de Uni · Pestaña Asignaturas',
      title: 'El corazón de tu cuatrimestre',
      emptySummary:
        'Aún no hay asignaturas aquí — elige una opción rápida abajo: crear a mano, subir una foto de tu horario o importar desde Google Calendar.',
      summary:
        'Cada carpeta guarda el temario por nivel de confianza (1–5), horario de clases, pesos de evaluación y enlaces a Drive o Cuaderno.',
      highlights: [
        'Foto del horario: analizo la imagen y creo asignaturas y clases con un toque.',
        'La confianza 1–5 + último recuerdo definen cuánto tiempo dedica el Plan a cada tema.',
      ],
    },
    calendario: {
      eyebrow: 'Guía de Uni · Pestaña Calendario',
      title: 'Clases, exámenes y agenda en un solo sitio',
      summary:
        'Cruza tu horario semanal con exámenes y eventos de Google Calendar. El Plan evita programar estudio sobre horas ocupadas.',
      highlights: [
        'Si conectaste Google Calendar, sincroniza eventos y extrae clases y exámenes a Asignaturas.',
        'Pulsa «+ Nuevo» para añadir exámenes manuales y fechas límite.',
      ],
    },
    plano: {
      eyebrow: 'Guía de Uni · Pestaña Plan',
      title: 'No es solo una lista: aprende con ciencia',
      summary:
        'El generador combina bloques cortos adaptativos, Modo Examen (<10 días) y Repetición Espaciada continua (1 → 3 → 7 → 21 días) con recuerdo activo al terminar.',
      highlights: [
        'Elige franja preferida, duración (25m a 75m) y asignaturas a reforzar en «Generar plan».',
        'Los temas con confianza 1–2 reciben bloques más cortos (≤35 min) para no saturarte.',
        'Marca cada bloque completado en el temporizador para programar el siguiente repaso.',
      ],
    },
    progresso: {
      eyebrow: 'Guía de Uni · Pestaña Progreso',
      title: 'Dónde vas fuerte y qué conviene reforzar',
      summary:
        'Cruza las horas estudiadas con tu confianza por asignatura e identifica qué necesita atención antes del próximo examen.',
      highlights: [
        'Cada racha diaria y repaso de recuerdo activo desbloquea nuevos aspectos coleccionables para Uni.',
      ],
    },
    materiais: {
      eyebrow: 'Guía de Uni · Pestaña Materiales',
      title: 'Carpetas automáticas, exámenes y base para el Tutor',
      summary:
        'Agrupa PDFs locales, carpetas de Google Drive y cuadernos externos por asignatura, incluso si el nombre del archivo no lleva las siglas.',
      highlights: [
        'Escaneo Drive / PC: organiza carpetas por asignatura y vincula la carpeta raíz.',
        'Fija materiales prioritarios: el Tutor lee automáticamente tus PDFs y apuntes reales.',
      ],
    },
    assistente: {
      eyebrow: 'Guía de Uni · Uni Tutor',
      title: 'Explicaciones guiadas por tu cuaderno',
      summary:
        'Ya conozco tus asignaturas, próximos exámenes y temas más débiles. Tienes mensajes diarios incluidos en Uni Nativo y puedes añadir tu clave gratuita de Google AI Studio.',
      highlights: [
        'Toca el contador diario arriba si quieres ver la guía de 1 minuto para poner tu clave Gemini.',
        'Alterna entre Cercano, Exigente, Sin estrés, Curioso o Entrenador según necesites.',
      ],
    },
    definicoes: {
      eyebrow: 'Guía de Uni · Ajustes',
      title: 'Control de conexiones, idioma y privacidad',
      summary:
        'Configura tu clave personal Gemini, conecta Google Drive/Calendar/Gmail, cambia el idioma y exporta copias locales cuando quieras.',
      highlights: [
        'En «Uni · Tutor IA» tienes la guía paso a paso para obtener tu clave gratuita de Google AI Studio.',
      ],
    },
  },
  en: {
    dashboard: {
      eyebrow: 'Hi, I am Uni · Today Tab',
      title: 'Your live daily overview',
      summary:
        'Everything that matters today in one calm view: your next focus block, urgent exams, quick Post-it tasks, and course alerts.',
      highlights: [
        'Tap Focus today to start the timer with an active recall check at the end.',
        'Open the Weekly Check-in whenever you feel behind so your plan adapts immediately.',
      ],
    },
    cadeiras: {
      eyebrow: 'Uni Guide · Courses Tab',
      title: 'The hub of your semester',
      emptySummary:
        'No courses added yet — pick a fast option below: create manually, snap a photo of your timetable, or import directly from Google Calendar.',
      summary:
        'Each course folder tracks syllabus topics by confidence (1–5), weekly classes, grading weights, and Drive or notebook links.',
      highlights: [
        'Timetable photo: I scan the image and set up your courses and weekly classes in one tap.',
        'Confidence (1–5) + recall scores decide how much time your Plan allocates per topic.',
      ],
    },
    calendario: {
      eyebrow: 'Uni Guide · Calendar Tab',
      title: 'Classes, exams, and schedule together',
      summary:
        'Combines your weekly class timetable with exams and Google Calendar events so your Plan never schedules study during busy hours.',
      highlights: [
        'When Google Calendar is linked, sync events and extract exams straight into Courses.',
        'Press «+ New» to add manual exams and project deadlines.',
      ],
    },
    plano: {
      eyebrow: 'Uni Guide · Plan Tab',
      title: 'More than a to-do list: science-backed study',
      summary:
        'Combines adaptive short blocks, Exam Mode (<10 days), and Spaced Repetition (1 → 3 → 7 → 21 days) ending with a quick active recall check.',
      highlights: [
        'Pick preferred time of day, block duration (25m–75m), and boost courses in «Generate plan».',
        'Low-confidence topics (1–2) get shorter blocks (≤35 min) to prevent fatigue.',
        'Finish blocks in Focus mode to automatically schedule the next spaced review.',
      ],
    },
    progresso: {
      eyebrow: 'Uni Guide · Progress Tab',
      title: 'Where you shine and what needs review',
      summary:
        'Combines actual study hours with topic retention and course averages so you spot weak areas before exam week.',
      highlights: [
        'Streaks and completed recall sessions unlock new collectible Uni looks and pets.',
      ],
    },
    materiais: {
      eyebrow: 'Uni Guide · Materials Tab',
      title: 'Smart folders, past papers, and Tutor context',
      summary:
        'Organizes local PDFs, Google Drive folders, and external notebooks by course — even when filenames do not include the course code.',
      highlights: [
        'Drive / Folder scan: link your root folder to match materials automatically per course.',
        'Pin key files so Uni Tutor reads them directly when answering questions or building sheets.',
      ],
    },
    assistente: {
      eyebrow: 'Uni Guide · Uni Tutor',
      title: 'Explanations grounded in your own notebook',
      summary:
        'I already know your courses, upcoming exams, and tricky topics. Daily replies are included with Native Uni, or add your free Google AI Studio key for higher limits and Live Voice.',
      highlights: [
        'Tap the daily counter at the top for a 1-minute guide to adding your personal Gemini key.',
        'Switch between Friend, Strict, Calm, Curious, or Coach teaching styles anytime.',
      ],
    },
    definicoes: {
      eyebrow: 'Uni Guide · Settings',
      title: 'Your connections, language & privacy control',
      summary:
        'Add your personal Gemini key, manage Google Drive/Calendar/Gmail access, switch interface language or grading scale, and export backups anytime.',
      highlights: [
        'Open «Uni · AI Tutor» for step-by-step instructions to get a free Google AI Studio key.',
      ],
    },
  },
};

export function getLocalizedTabGuide(tabKey: AppTabKey, lang: AppLanguage | string = 'pt-PT'): TabGuideSpec {
  const base = TAB_GUIDES[tabKey];
  const normalized = normalizeAppLanguage(lang);
  if (normalized === 'pt-PT') return base;
  const override = TAB_GUIDE_OVERRIDES[normalized]?.[tabKey];
  return override ? { ...base, ...override } : base;
}
