/**
 * Traçados oficiais do Uni (viewBox 0 0 80 80), sem dependências: usados pela app (`UniBuddy`)
 * e pelo site de apresentação, para os Unis serem exatamente iguais nos dois.
 */
/** Igual a `UniFormId` (lib/localDb), repetido aqui para o site não puxar a base de dados local. */
export type UniShapeId = 'nuvem' | 'gota' | 'estrela' | 'cristal' | 'folha';
export const UNI_SHAPES: UniShapeId[] = ['nuvem', 'gota', 'estrela', 'cristal', 'folha'];

export const UNI_FORM_BODY_PATHS: Record<UniShapeId, string> = {
  nuvem:
    'M40 8C46.5 8 51.2 12.2 54.8 14.2C59.2 16.6 64.5 17.5 67.2 22.2C69.8 26.8 68 32.3 69.2 37.5C70.4 42.6 74 47.4 71.8 52.8C69.7 58 63.8 59.8 59.3 63.1C54.9 66.3 51.2 71.8 45.4 72C39.6 72.2 35.4 67.5 30.1 66.2C24.8 64.9 18.2 66.8 14.3 62.6C10.4 58.3 12.1 51.7 10.6 46.2C9.1 40.8 5.2 35.8 7.4 30.2C9.5 24.7 15.8 23.8 19.8 19.6C23.8 15.3 25.4 9.5 31.1 8.4C34.2 7.8 37.2 8 40 8Z',
  gota: 'M40 8C48 16 68 32 68 50C68 63.5 55.5 72 40 72C24.5 72 12 63.5 12 50C12 32 32 16 40 8Z',
  estrela:
    'M40 7C44 17 50 19 62 20C70 21 71 29 63 36C59 40 60 46 65 56C69 65 62 71 53 66C45 62 35 62 27 66C18 71 11 65 15 56C20 46 21 40 17 36C9 29 10 21 18 20C30 19 36 17 40 7Z',
  cristal:
    'M40 7L64 20C67.5 22 69 25 69 29L67 52C66.5 56.5 64 59 60 61L40 72L20 61C16 59 13.5 56.5 13 52L11 29C11 25 12.5 22 16 20Z',
  folha: 'M40 8C56 12 69 26 68 46C67 62 54 71 40 72C26 71 13 62 12 46C11 26 24 12 40 8Z',
};

/** Facetas discretas das formas Cristal e Folha. */
export const UNI_FORM_FACETS: Partial<Record<UniShapeId, string>> = {
  cristal: 'M16 21L40 28L64 21M40 7V28',
  folha: 'M40 16V68M40 31L51 24M40 44L29 37',
};

/** Estágio 0 (Ovo): contorno do ovo de papel. */
export const UNI_EGG_PATH = 'M40 4C53 4 66 22 66 46C66 62 55 72 40 72C25 72 14 62 14 46C14 22 27 4 40 4Z';

/** Marcador coral no topo, olhos, bochechas e sorriso (posição base). */
export const UNI_BOOKMARK_PATH = 'M36 9V2L40 5.5L44 2V9';
export const UNI_SMILE_PATH = 'M33.5 44.5C35.8 49.2 44.2 49.2 46.5 44.5';
