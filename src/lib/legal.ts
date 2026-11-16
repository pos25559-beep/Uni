/** Identidade legal e contactos oficiais da Unipedia para RGPD e Google Play Store. */
export const LEGAL_INFO = {
  appName: 'Unipedia',
  controllerName: 'Pedro de Oliveira Silva',
  country: 'Portugal',
  contactEmail: 'contacto.unipedia@gmail.com',
  minimumAgePT: 13,
  lastUpdated: '2026-11-16',
  policyVersion: '2026-11-16-v3',
  publicBaseUrl: 'https://campus-erp-84964.web.app',
  supervisoryAuthority: {
    name: 'Comissão Nacional de Proteção de Dados (CNPD)',
    url: 'https://www.cnpd.pt',
  },
  /** Autoridades de controlo por país, mostradas na secção de reclamações. */
  authorities: [
    { id: 'pt', name: 'CNPD — Comissão Nacional de Proteção de Dados', url: 'https://www.cnpd.pt' },
    { id: 'es', name: 'AEPD — Agencia Española de Protección de Datos', url: 'https://www.aepd.es' },
    { id: 'br', name: 'ANPD — Autoridade Nacional de Proteção de Dados', url: 'https://www.gov.br/anpd' },
    { id: 'uk', name: "ICO — Information Commissioner's Office", url: 'https://ico.org.uk' },
    { id: 'eu', name: 'EDPB — lista das autoridades nacionais', url: 'https://www.edpb.europa.eu/about-edpb/about-edpb/members_en' },
  ],
} as const;
