'use client';

import { cmsAdminCreate, cmsAdminList, cmsImportCatalog } from '@/lib/cms-admin';
import { saveOrders, saveQuotes, type Order, type Quote } from '@/lib/crm-store';

export const DEMO_FLAG = 'sari_demo_v3';
const PASS = 'ChangeMe_Sari2026!';

const CLIENTS = [
  { email: 'marie@clinique-saintlouis.fr', firstName: 'Marie', lastName: 'Laurent', phone: '+33 6 12 34 56 78', company: 'Clinique Saint-Louis', type: 'client', status: 'active', address: '12 rue des Lilas, Lyon' },
  { email: 'achats@chu-lyon.fr', firstName: 'Hélène', lastName: 'Moreau', phone: '+33 4 72 11 22 33', company: 'CHU de Lyon', type: 'client', status: 'active', address: '103 Grande Rue de la Croix-Rousse, Lyon' },
  { email: 'secretariat@cabinet-parc.dz', firstName: 'Nassim', lastName: 'Benali', phone: '+213 21 44 55 66', company: 'Cabinet Médical du Parc', type: 'client', status: 'active', address: 'Lotissement El Biar, Alger' },
  { email: 'direction@eliafia.dz', firstName: 'Soraya', lastName: 'Hamidi', phone: '+213 23 11 22 33', company: 'Clinique El Afia', type: 'client', status: 'active', address: 'Route de Staoueli, Alger' },
  { email: 'achats@mustapha.dz', firstName: 'Youcef', lastName: 'Kaci', phone: '+213 21 23 45 67', company: 'CHU Mustapha Pacha', type: 'client', status: 'active', address: 'Place du 1er Mai, Alger' },
  { email: 'contact@ibn-sina.dz', firstName: 'Amine', lastName: 'Cherif', phone: '+213 555 88 21 09', company: 'Laboratoire Ibn Sina', type: 'client', status: 'pending', address: 'Hydra, Alger' },
  { email: 'amina.k@cabinet.dz', firstName: 'Amina', lastName: 'Khelifi', phone: '+213 555 12 34 56', company: 'Cabinet Khelifi', type: 'client', status: 'active', address: 'Bir Mourad Raïs, Alger' },
  { email: 'direction@oran-est.dz', firstName: 'Farid', lastName: 'Messaoudi', phone: '+213 41 33 20 18', company: 'Polyclinique Oran Est', type: 'client', status: 'active', address: 'Bd de l’ALN, Oran' },
  { email: 'achats@ghn.dz', firstName: 'Leila', lastName: 'Saadi', phone: '+213 21 98 76 54', company: 'Groupe Hospitalier Nord', type: 'client', status: 'active', address: 'Bab El Oued, Alger' },
];

const CANDIDATES = [
  { email: 'fatima.zahra@email.dz', firstName: 'Fatima', lastName: 'Zahra', phone: '+213 555 567 890', position: 'Technicienne biomédicale', experience: '3 ans — CHU Mustapha', motivation: 'Passionnée par la maintenance des échographes et le SAV terrain.', type: 'candidate', status: 'active' },
  { email: 'karim.boudiaf@email.dz', firstName: 'Karim', lastName: 'Boudiaf', phone: '+213 555 111 222', position: 'Commercial médical', experience: '5 ans — distributeur dispositifs', motivation: 'Portefeuille cliniques privées à Alger et Oran.', type: 'candidate', status: 'pending' },
  { email: 'sara.meziane@email.dz', firstName: 'Sara', lastName: 'Meziane', phone: '+213 555 440 118', position: 'Ingénieure application imagerie', experience: '4 ans — GE Healthcare partenaire', motivation: 'Formations utilisateurs et recette de salles.', type: 'candidate', status: 'active' },
  { email: 'yacine.larbi@email.dz', firstName: 'Yacine', lastName: 'Larbi', phone: '+213 555 902 441', position: 'Technicien autoclaves', experience: '6 ans — bloc opératoire', motivation: 'Spécialiste classe B et qualification IQ/OQ.', type: 'candidate', status: 'active' },
  { email: 'ines.hammoudi@email.dz', firstName: 'Inès', lastName: 'Hammoudi', phone: '+213 555 220 773', position: 'Chargée de clientèle B2B', experience: '2 ans — call center médical', motivation: 'Suivi devis et relance hôpitaux publics.', type: 'candidate', status: 'pending' },
];

export const DEMO_APPLICATIONS = [
  { id: 501, candidate: 'Fatima Zahra', email: 'fatima.zahra@email.dz', phone: '+213 555 567 890', jobTitle: 'Technicien Biomédical', offerId: 1, status: 'interview', date: '2026-07-15', experience: '3 ans', motivation: 'Je souhaite rejoindre le SAV SARI pour intervenir sur le parc échographes des cliniques d’Alger.', cv: 'FATIMA ZAHRA\nTechnicienne biomédicale — 3 ans\nCHU Mustapha Pacha · maintenance échographes, moniteurs et autoclaves.\nCompétences : électronique médicale, DICOM, qualification IQ/OQ.\n', lm: 'Madame, Monsieur,\nForte d’une expérience de 3 ans en maintenance biomédicale, je souhaite intégrer votre service SAV pour intervenir sur le terrain.' },
  { id: 502, candidate: 'Karim Boudiaf', email: 'karim.boudiaf@email.dz', phone: '+213 555 111 222', jobTitle: 'Commercial Sectoriel BtoB', offerId: 2, status: 'reviewed', date: '2026-07-10', experience: '5 ans', motivation: 'Réseau de 40 établissements déjà suivis. Objectif : développer l’Ouest algérien.', cv: 'KARIM BOUDIAF\nCommercial médical — 5 ans\nPortefeuille de 40 établissements (cliniques privées, hôpitaux).\nCompétences : prospection B2B, appels d’offres, CRM.\n', lm: 'Je souhaite mettre mon réseau au service du développement commercial de SARI Système sur l’Ouest algérien.' },
  { id: 503, candidate: 'Sara Meziane', email: 'sara.meziane@email.dz', phone: '+213 555 440 118', jobTitle: "Ingénieur d'Application Imagerie", offerId: 5, status: 'new', date: '2026-08-02', experience: '4 ans', motivation: 'Expérience recette salles d’écho et formation médecins.', cv: 'SARA MEZIANE\nIngénieure application imagerie — 4 ans\nRecette de salles d’échographie, formation utilisateurs.\nCompétences : échographie, PACS, conduite de projet.\n', lm: 'Mon expertise en imagerie médicale et en formation utilisateurs correspond au profil recherché.' },
  { id: 504, candidate: 'Yacine Larbi', email: 'yacine.larbi@email.dz', phone: '+213 555 902 441', jobTitle: 'Technicien de Surface Médical', offerId: 6, status: 'accepted', date: '2026-06-20', experience: '6 ans', motivation: 'Qualification IQ/OQ des autoclaves classe B, disponible immédiatement.', cv: 'YACINE LARBI\nTechnicien autoclaves — 6 ans\nSpécialiste classe B, qualification IQ/OQ.\nCompétences : stérilisation, hygiène hospitalière.\n', lm: 'Disponible immédiatement, je souhaite mettre mon expertise stérilisation au service de vos clients.' },
  { id: 505, candidate: 'Inès Hammoudi', email: 'ines.hammoudi@email.dz', phone: '+213 555 220 773', jobTitle: 'Chargé de Clientèle Sénior', offerId: 12, status: 'rejected', date: '2026-07-28', experience: '2 ans', motivation: 'Souhaite passer du support au suivi devis / commandes.', cv: 'INÈS HAMMOUDI\nChargée de clientèle B2B — 2 ans\nSuivi devis et relance hôpitaux publics.\nCompétences : relation client, ERP, devis.\n', lm: 'Je souhaite évoluer vers le suivi complet devis / commandes au sein de votre équipe commerciale.' },
  { id: 506, candidate: 'Fatima Zahra', email: 'fatima.zahra@email.dz', phone: '+213 555 567 890', jobTitle: 'Technicien Biomédical', offerId: 1, status: 'new', date: '2026-08-12', experience: '3 ans', motivation: 'Candidature interne de progression après l’entretien technicien.', cv: 'FATIMA ZAHRA\nTechnicienne biomédicale — 3 ans\nCHU Mustapha Pacha · maintenance échographes, moniteurs et autoclaves.\n', lm: 'Candidature interne pour progression vers un poste à responsabilités au sein du SAV.' },
  { id: 507, candidate: 'Amine Touati', email: 'amine.touati@email.dz', phone: '+213 555 330 912', jobTitle: 'Technicien Biomédical', offerId: 1, status: 'new', date: '2026-08-10', experience: '2 ans', motivation: 'Jeune diplômé spécialisé en instrumentation médicale.', cv: 'AMINE TOUATI\nTechnicien biomédical junior — 2 ans\nStage CHU + certification électronique médicale.\n', lm: 'Débutant motivé, je souhaite rejoindre une équipe terrain dynamique.' },
  { id: 508, candidate: 'Nora Ait', email: 'nora.ait@email.dz', phone: '+213 555 771 204', jobTitle: 'Technicien Biomédical', offerId: 1, status: 'reviewed', date: '2026-08-01', experience: '7 ans', motivation: 'Experte imagerie et blocs opératoires, référente SAV.' , cv: 'NORA AIT\nTechnicienne biomédicale senior — 7 ans\nRéférente SAV imagerie et blocs opératoires.\n', lm: 'Mon expérience senior me permet d’encadrer une équipe et d’assurer le SAV régional.' },
  { id: 509, candidate: 'Riad Mansouri', email: 'riad.mansouri@email.dz', phone: '+213 555 118 733', jobTitle: 'Commercial Sectoriel BtoB', offerId: 2, status: 'interview', date: '2026-08-08', experience: '4 ans', motivation: 'Réseau hôpitaux publics et appels d’offres.', cv: 'RIAD MANSOURI\nCommercial B2B — 4 ans\nRéseau hôpitaux publics, appels d’offres nationaux.\n', lm: 'Je souhaite piloter les grands comptes publics de SARI Système.' },
  { id: 510, candidate: 'Lina Kaci', email: 'lina.kaci@email.dz', phone: '+213 555 664 029', jobTitle: 'Chargé de Clientèle Sénior', offerId: 12, status: 'new', date: '2026-08-14', experience: '3 ans', motivation: 'Expérience en suivi de commandes et SAV commercial.', cv: 'LINA KACI\nChargée de clientèle — 3 ans\nSuivi commandes, SAV commercial, fidélisation.\n', lm: 'Je souhaite accompagner vos clients sur le suivi complet de leurs commandes.' },
];

export const DEMO_ORDERS: Order[] = [
  { id: 1001, client: 'Dr. Marie Laurent', email: 'marie@clinique-saintlouis.fr', phone: '+33 6 12 34 56 78', company: 'Clinique Saint-Louis', date: '2026-01-15', status: 'delivered', total: 450000, payment: 'virement', cost: 310000, ip: '5.135.10.20', zone: 'DZ', quoteId: 2004, address: '12 rue des Lilas, Lyon', items: [{ id: 1, name: 'Échographe Portable Pro X1', quantity: 1, price: 450000, category: 'Diagnostic' }] },
  { id: 1002, client: 'CHU de Lyon', email: 'achats@chu-lyon.fr', phone: '+33 4 72 11 22 33', company: 'CHU de Lyon', date: '2026-02-01', status: 'delivered', total: 1850000, payment: 'cib', cost: 1280000, zone: 'DZ', items: [{ id: 7, name: 'Défibrillateur Semi-Automatique', quantity: 2, price: 850000, category: 'Urgence' }, { id: 15, name: 'Moniteur de Signes Vitaux Multiparamètres', quantity: 1, price: 150000, category: 'Urgence' }] },
  { id: 1003, client: 'Cabinet Médical du Parc', email: 'secretariat@cabinet-parc.dz', phone: '+213 21 44 55 66', company: 'Cabinet du Parc', date: '2026-03-10', status: 'pending', total: 85000, payment: 'cod', cost: 42000, coupon: 'SARI10', ip: '41.111.200.30', zone: 'DZ', address: 'El Biar, Alger', items: [{ id: 4, name: 'Tensiomètre Digital Pro', quantity: 5, price: 12000, category: 'Diagnostic' }, { id: 5, name: 'Microscope Binoculaire LED', quantity: 1, price: 25000, category: 'Diagnostic' }] },
  { id: 1004, client: 'Clinique El Afia', email: 'direction@eliafia.dz', phone: '+213 23 11 22 33', company: 'Clinique El Afia', date: '2026-04-20', status: 'shipped', total: 1250000, payment: 'virement', cost: 840000, zone: 'DZ', items: [{ id: 3, name: 'Stérilisateur Autoclave Classe B', quantity: 1, price: 350000, category: 'Chirurgie' }, { id: 9, name: 'Lampe Scialytique Mobile LED', quantity: 2, price: 450000, category: 'Chirurgie' }] },
  { id: 1005, client: 'CHU Mustapha Pacha', email: 'achats@mustapha.dz', phone: '+213 21 23 45 67', company: 'CHU Mustapha', date: '2026-05-08', status: 'delivered', total: 6200000, payment: 'transfer', cost: 4100000, ip: '41.111.200.31', zone: 'DZ', quoteId: 2001, items: [{ id: 1, name: 'Échographe Portable Pro X1', quantity: 4, price: 750000, category: 'Diagnostic' }, { id: 15, name: 'Moniteur de Signes Vitaux Multiparamètres', quantity: 2, price: 1600000, category: 'Urgence' }] },
  { id: 1006, client: 'Laboratoire Ibn Sina', email: 'contact@ibn-sina.dz', date: '2026-05-22', status: 'cancelled', total: 280000, payment: 'check', cost: 0, zone: 'DZ', items: [{ id: 5, name: 'Microscope Binoculaire LED', quantity: 2, price: 140000, category: 'Diagnostic' }] },
  { id: 1007, client: 'Dr. Amina Khelifi', email: 'amina.k@cabinet.dz', phone: '+213 555 12 34 56', company: 'Cabinet Khelifi', date: '2026-06-18', status: 'delivered', total: 2880000, payment: 'card-intl', cost: 1920000, coupon: 'SARI10', zone: 'DZ', items: [{ id: 1, name: 'Échographe Portable Pro X1', quantity: 1, price: 3200000, category: 'Diagnostic' }] },
  { id: 1008, client: 'Clinique El Afia', email: 'direction@eliafia.dz', date: '2026-06-22', status: 'processing', total: 4200000, payment: 'cib', cost: 2750000, coupon: 'CLINIQUE5000', zone: 'DZ', items: [{ id: 7, name: 'Défibrillateur Semi-Automatique', quantity: 3, price: 850000, category: 'Urgence' }, { id: 6, name: 'Pack Consommables Starter', quantity: 10, price: 18000, category: 'Consommables' }] },
  { id: 1009, client: 'Polyclinique Oran Est', email: 'direction@oran-est.dz', date: '2026-07-04', status: 'delivered', total: 980000, payment: 'paypal', cost: 610000, zone: 'DZ', items: [{ id: 15, name: 'Moniteur de Signes Vitaux Multiparamètres', quantity: 4, price: 245000, category: 'Urgence' }] },
  { id: 1010, client: 'Dr. Marie Laurent', email: 'marie@clinique-saintlouis.fr', date: '2026-07-28', status: 'processing', total: 720000, payment: 'virement', cost: 480000, zone: 'DZ', items: [{ id: 3, name: 'Stérilisateur Autoclave Classe B', quantity: 2, price: 360000, category: 'Chirurgie' }] },
  { id: 1011, client: 'Groupe Hospitalier Nord', email: 'achats@ghn.dz', date: '2026-08-05', status: 'pending', total: 2500000, payment: 'transfer', cost: 1680000, ip: '41.111.200.32', zone: 'DZ', quoteId: 2001, items: [{ id: 1, name: 'Échographe Portable Pro X1', quantity: 2, price: 450000, category: 'Diagnostic' }, { id: 8, name: 'Concentrateur d’Oxygène 5L', quantity: 4, price: 400000, category: 'Respiratoire' }] },
];

export const DEMO_QUOTES: Quote[] = [
  { id: 2001, client: 'Groupe Hospitalier Nord', email: 'achats@ghn.dz', phone: '+213 21 98 76 54', company: 'GHN', date: '2026-07-25', status: 'accepted', total: 2500000, validity: '30 jours', orderId: 1011, ip: '41.111.200.32', zone: 'DZ', items: [{ id: 1, name: 'Échographe Portable Pro X1', quantity: 2, price: 450000, category: 'Diagnostic' }, { id: 8, name: 'Concentrateur d’Oxygène 5L', quantity: 4, price: 400000, category: 'Respiratoire' }] },
  { id: 2002, client: 'Dr. Thomas Bernard', email: 'thomas@cabinet.dz', date: '2026-07-28', status: 'sent', total: 320000, validity: '15 jours', zone: 'DZ', items: [{ id: 3, name: 'Stérilisateur Autoclave Classe B', quantity: 1, price: 320000, category: 'Chirurgie' }] },
  { id: 2003, client: 'Clinique Saint-Louis', email: 'marie@clinique-saintlouis.fr', date: '2026-07-30', status: 'accepted', total: 850000, validity: '30 jours', zone: 'DZ', items: [{ id: 7, name: 'Défibrillateur Semi-Automatique', quantity: 1, price: 850000, category: 'Urgence' }] },
  { id: 2004, client: 'Dr. Marie Laurent', email: 'marie@clinique-saintlouis.fr', date: '2025-12-20', status: 'accepted', total: 450000, validity: '30 jours', orderId: 1001, ip: '5.135.10.20', zone: 'DZ', items: [{ id: 1, name: 'Échographe Portable Pro X1', quantity: 1, price: 450000, category: 'Diagnostic' }] },
  { id: 2005, client: 'Laboratoire Ibn Sina', email: 'contact@ibn-sina.dz', date: '2026-06-01', status: 'rejected', total: 640000, validity: '15 jours', zone: 'DZ', items: [{ id: 5, name: 'Microscope Binoculaire LED', quantity: 4, price: 160000, category: 'Diagnostic' }] },
  { id: 2006, client: 'Polyclinique Oran Est', email: 'direction@oran-est.dz', date: '2026-08-12', status: 'pending', total: 1870000, validity: '21 jours', coupon: 'SARI10', zone: 'DZ', items: [{ id: 15, name: 'Moniteur de Signes Vitaux Multiparamètres', quantity: 3, price: 245000, category: 'Urgence' }, { id: 4, name: 'Tensiomètre Digital Pro', quantity: 10, price: 12000, category: 'Diagnostic' }] },
];

const PARTNERS = [
  { email: 'partenaire@medic-distrib.dz', firstName: 'Rachid', lastName: 'Boumediene', phone: '+213 21 50 60 70', company: 'Medic Distrib', type: 'partner', status: 'active', address: 'Alger Centre' },
  { email: 'partenaire@bio-lab-ouest.dz', firstName: 'Nadia', lastName: 'Ferhat', phone: '+213 41 44 55 66', company: 'Bio Lab Ouest', type: 'partner', status: 'active', address: 'Oran' },
  { email: 'partenaire@sante-sud.dz', firstName: 'Sofiane', lastName: 'Gherbi', phone: '+213 32 12 13 14', company: 'Santé Sud', type: 'partner', status: 'pending', address: 'Constantine' },
  { email: 'partenaire@imagerie-est.dz', firstName: 'Lyna', lastName: 'Benaissa', phone: '+213 31 20 21 22', company: 'Imagerie Est', type: 'partner', status: 'active', address: 'Annaba' },
];

async function ensurePeople() {
  // `limit` est plafonné à 100 par l'API : la valeur 200 déclenchait une 400
  // (« limit must not be greater than 100 »), et l'amorçage échouait.
  const existing: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 20; page += 1) {
    const chunk = await cmsAdminList('users', { limit: '100', page: String(page) });
    existing.push(...chunk);
    if (chunk.length < 100) break;
  }
  const emails = new Set(existing.map((u) => String(u.email || '').toLowerCase()));
  for (const person of [...CLIENTS, ...CANDIDATES, ...PARTNERS]) {
    if (emails.has(person.email.toLowerCase())) continue;
    try {
      await cmsAdminCreate('users', { ...person, password: PASS, locale: 'fr' });
    } catch {
      /* ignore duplicates */
    }
  }
}

export async function seedDemoWorkspace() {
  saveOrders(DEMO_ORDERS);
  saveQuotes(DEMO_QUOTES);
  localStorage.setItem('sari_applications', JSON.stringify(DEMO_APPLICATIONS));
  localStorage.setItem(DEMO_FLAG, '1');

  let imported = 0;
  try {
    const result = await cmsImportCatalog(false);
    imported = Object.values(result.imported || {}).reduce((a, b) => a + Number(b), 0);
  } catch {
    imported = 0;
  }
  try {
    await ensurePeople();
  } catch {
    /* API offline */
  }
  return { imported, orders: DEMO_ORDERS.length, quotes: DEMO_QUOTES.length, applications: DEMO_APPLICATIONS.length, people: CLIENTS.length + CANDIDATES.length + PARTNERS.length };
}
