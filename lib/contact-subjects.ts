import type { Subject } from '@/backend/src/modules/contact/contact-contract';

/** Clés de pages.contact, communes au sélecteur vitrine, aux règles et au suivi. */
export const subjectLabels: Record<Subject, string> = {
  devis: 'subjectQuote',
  technique: 'subjectTechnical',
  commercial: 'subjectCommercial',
  rh: 'subjectHR',
  partenaire: 'subjectPartner',
  client: 'subjectClient',
};
