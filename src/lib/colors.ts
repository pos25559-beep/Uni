import type { AssessmentKind, CourseColor, MaterialProvider, TopicStatus } from '../types';

/**
 * Paleta de cadeiras em papelaria tátil (sem roxo AI-slop).
 * `violet` permanece como chave legada mapeada para Azeitona/Salva para não quebrar dados guardados.
 */
export const courseColors: Record<
  CourseColor,
  {
    dot: string;
    soft: string;
    text: string;
    border: string;
    tint: string;
    block: string;
    hex: string;
    label: string;
  }
> = {
  emerald: {
    dot: 'bg-[#157F58] dark:bg-[#4ADE80]',
    soft: 'bg-[#DCF4EA] text-[#0E5E40] dark:bg-[#173327] dark:text-[#6EE7B7]',
    text: 'text-[#157F58] dark:text-[#4ADE80]',
    border: 'border-[#157F58]/30 dark:border-[#4ADE80]/30',
    tint: 'bg-[#BCEEE0]/75 border-[#8ED9C4] dark:bg-[#17312B]/80 dark:border-[#2A594D]',
    block: 'bg-[#BCEEE0] text-[#141312] dark:bg-[#19352E] dark:text-[#FAF6EC]',
    hex: '#157F58',
    label: 'Menta Caderno',
  },
  amber: {
    dot: 'bg-[#D97706] dark:bg-[#FBBF24]',
    soft: 'bg-[#FCE99F]/70 text-[#6B4800] dark:bg-[#352D14] dark:text-[#FDE68A]',
    text: 'text-[#9A5B00] dark:text-[#FCD34D]',
    border: 'border-[#D97706]/30 dark:border-[#FBBF24]/30',
    tint: 'bg-[#FCE99F]/75 border-[#EBD16B] dark:bg-[#352D14]/80 dark:border-[#5C4D1E]',
    block: 'bg-[#FCE99F] text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]',
    hex: '#D97706',
    label: 'Manteiga',
  },
  sky: {
    dot: 'bg-[#1D6FD6] dark:bg-[#60A5FA]',
    soft: 'bg-[#C4E0FD]/75 text-[#124585] dark:bg-[#192A3D] dark:text-[#93C5FD]',
    text: 'text-[#1D5FAD] dark:text-[#93C5FD]',
    border: 'border-[#1D6FD6]/30 dark:border-[#60A5FA]/30',
    tint: 'bg-[#C4E0FD]/75 border-[#93C4F9] dark:bg-[#192A3D]/80 dark:border-[#2C4766]',
    block: 'bg-[#C4E0FD] text-[#141312] dark:bg-[#1A2C40] dark:text-[#FAF6EC]',
    hex: '#1D6FD6',
    label: 'Azul Céu',
  },
  orange: {
    dot: 'bg-[#E04F33] dark:bg-[#FF7A59]',
    soft: 'bg-[#FAD6BA]/80 text-[#8F2B16] dark:bg-[#382317] dark:text-[#FDBA74]',
    text: 'text-[#C24124] dark:text-[#FCA58E]',
    border: 'border-[#E04F33]/30 dark:border-[#FF7A59]/30',
    tint: 'bg-[#FAD6BA]/75 border-[#EBB791] dark:bg-[#382317]/80 dark:border-[#5E3824]',
    block: 'bg-[#FAD6BA] text-[#141312] dark:bg-[#382317] dark:text-[#FAF6EC]',
    hex: '#E04F33',
    label: 'Pêssego Coral',
  },
  lime: {
    dot: 'bg-[#5B7E26] dark:bg-[#A3E635]',
    soft: 'bg-[#C9DC9F]/80 text-[#334A12] dark:bg-[#212E19] dark:text-[#BEF264]',
    text: 'text-[#4B6B1D] dark:text-[#BEF264]',
    border: 'border-[#5B7E26]/30 dark:border-[#A3E635]/30',
    tint: 'bg-[#C9DC9F]/75 border-[#A5BF70] dark:bg-[#212E19]/80 dark:border-[#3A522B]',
    block: 'bg-[#C9DC9F] text-[#141312] dark:bg-[#23311B] dark:text-[#FAF6EC]',
    hex: '#5B7E26',
    label: 'Salva Oliva',
  },
  rose: {
    dot: 'bg-[#D64550] dark:bg-[#FB7185]',
    soft: 'bg-[#F9C5BE]/80 text-[#87212A] dark:bg-[#381E21] dark:text-[#FDA4AF]',
    text: 'text-[#B52F3B] dark:text-[#FDA4AF]',
    border: 'border-[#D64550]/30 dark:border-[#FB7185]/30',
    tint: 'bg-[#F9C5BE]/75 border-[#E89D93] dark:bg-[#381E21]/80 dark:border-[#613036]',
    block: 'bg-[#F9C5BE] text-[#141312] dark:bg-[#3A1E22] dark:text-[#FAF6EC]',
    hex: '#D64550',
    label: 'Rosa Papel',
  },
  cyan: {
    dot: 'bg-[#0E7490] dark:bg-[#22D3EE]',
    soft: 'bg-[#BAE6EC]/80 text-[#0E5163] dark:bg-[#142D35] dark:text-[#67E8F9]',
    text: 'text-[#0E7490] dark:text-[#67E8F9]',
    border: 'border-[#0E7490]/30 dark:border-[#22D3EE]/30',
    tint: 'bg-[#BAE6EC]/75 border-[#87CDD8] dark:bg-[#142D35]/80 dark:border-[#24515E]',
    block: 'bg-[#BAE6EC] text-[#141312] dark:bg-[#142D35] dark:text-[#FAF6EC]',
    hex: '#0E7490',
    label: 'Água Clara',
  },
  // Chave legada mantida apenas para compatibilidade com cursos guardados anteriormente
  violet: {
    dot: 'bg-[#5B7E26] dark:bg-[#A3E635]',
    soft: 'bg-[#C9DC9F]/80 text-[#334A12] dark:bg-[#212E19] dark:text-[#BEF264]',
    text: 'text-[#4B6B1D] dark:text-[#BEF264]',
    border: 'border-[#5B7E26]/30 dark:border-[#A3E635]/30',
    tint: 'bg-[#C9DC9F]/75 border-[#A5BF70] dark:bg-[#212E19]/80 dark:border-[#3A522B]',
    block: 'bg-[#C9DC9F] text-[#141312] dark:bg-[#23311B] dark:text-[#FAF6EC]',
    hex: '#5B7E26',
    label: 'Oliva',
  },
};

export const colorNames = (Object.keys(courseColors) as CourseColor[]).filter(
  (c) => c !== 'violet',
);

export const kindLabel: Record<AssessmentKind, string> = {
  exame: 'Exame', teste: 'Teste', trabalho: 'Trabalho', projeto: 'Projeto', quiz: 'Quiz',
};

export const statusLabel: Record<TopicStatus, string> = {
  todo: 'Por estudar', learning: 'A aprender', review: 'Em revisão', done: 'Dominado',
};

export const providerLabel: Record<MaterialProvider, string> = {
  gdrive: 'Google Drive', onedrive: 'OneDrive', notebooklm: 'NotebookLM', clip: 'CLIP', link: 'Link', upload: 'Ficheiro',
};

export const weekdayShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const weekdayLong = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
