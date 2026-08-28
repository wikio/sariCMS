'use client';

/** Types d'étapes du parcours de candidature. */
export type FlowStepType =
  | 'personal'     // Informations personnelles
  | 'experience'   // Expérience professionnelle
  | 'motivation'   // Lettre de motivation
  | 'cv'           // CV
  | 'multiple'     // Choix multiple
  | 'single'       // Choix unique
  | 'open'         // Question ouverte
  | 'test';        // Test QI / aptitude

export interface PersonalField {
  key: string;
  label: string;
  required: boolean;
  hidden?: boolean;
}

export interface AnswerOption {
  id: string;
  label: string;
  correct?: boolean;
  blocking?: boolean;
}

export interface TestQuestion {
  id: string;
  question: string;
  options: AnswerOption[];
  timeLimit?: number; // secondes
}

export interface SkipRule {
  when: string;         // réponse (id d'option) ou 'any'
  operator: 'eq' | 'neq';
  value: string;
  action: 'next' | 'end';
  message?: string;
}

export interface FlowStep {
  id: string;
  type: FlowStepType;
  title: string;
  instructions: string;   // HTML
  required: boolean;
  scoreWeight?: number;   // contribution au score global (0 = non noté)
  // personal
  fields?: PersonalField[];
  // experience
  minExperiences?: number;
  // multiple / single
  answers?: AnswerOption[];
  // open
  minLength?: number;
  maxLength?: number;
  // test
  questions?: TestQuestion[];
  passThreshold?: number;
  timeLimit?: number;
  // logique conditionnelle
  skipRule?: SkipRule;
}

export interface FlowTemplate {
  id: string;
  label: string;
  category: string;
  steps: FlowStep[];
}

export const FLOW_STEP_META: Record<FlowStepType, { label: string; icon: string; desc: string; category: 'prédéfinie' | 'dynamique' }> = {
  personal:   { label: 'Informations personnelles', icon: 'user', desc: 'Nom, prénom, email, âge, adresse, téléphone…', category: 'prédéfinie' },
  experience: { label: 'Expérience professionnelle', icon: 'briefcase', desc: 'Répéteur de postes, entreprises, durées.', category: 'prédéfinie' },
  motivation: { label: 'Lettre de motivation', icon: 'file-text', desc: 'Texte riche + upload PDF/DOCX.', category: 'prédéfinie' },
  cv:         { label: 'CV', icon: 'file', desc: 'Upload de fichier, formats et taille configurables.', category: 'prédéfinie' },
  multiple:   { label: 'Choix multiple', icon: 'check-square', desc: 'Cases à cocher, scoring optionnel.', category: 'dynamique' },
  single:     { label: 'Choix unique', icon: 'circle', desc: 'Boutons radio, réponse bloquante possible.', category: 'dynamique' },
  open:       { label: 'Question ouverte', icon: 'edit', desc: 'Champ texte libre, longueur min/max.', category: 'dynamique' },
  test:       { label: 'Test QI / aptitude', icon: 'brain', desc: 'Questions chronométrées, scoring auto.', category: 'dynamique' },
};

const PERSONAL_FIELDS: PersonalField[] = [
  { key: 'firstName', label: 'Prénom', required: true },
  { key: 'lastName', label: 'Nom', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'age', label: 'Âge', required: false },
  { key: 'gender', label: 'Sexe', required: false },
  { key: 'address', label: 'Adresse', required: false },
  { key: 'phone', label: 'Téléphone', required: true },
];

export function newStep(type: FlowStepType): FlowStep {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const base: FlowStep = {
    id,
    type,
    title: FLOW_STEP_META[type].label,
    instructions: '',
    required: type !== 'multiple',
  };
  switch (type) {
    case 'personal':
      return { ...base, fields: PERSONAL_FIELDS.map((f) => ({ ...f })) };
    case 'experience':
      return { ...base, minExperiences: 1 };
    case 'multiple':
    case 'single':
      return { ...base, answers: [
        { id: 'a1', label: 'Oui' },
        { id: 'a2', label: 'Non' },
      ], scoreWeight: 0 };
    case 'open':
      return { ...base, minLength: 0, maxLength: 2000 };
    case 'test':
      return { ...base, questions: [{ id: 'q1', question: 'Question 1', options: [
        { id: 'q1-a1', label: 'Réponse A' },
        { id: 'q1-a2', label: 'Réponse B' },
        { id: 'q1-a3', label: 'Réponse C' },
      ], timeLimit: 30 }], passThreshold: 50, scoreWeight: 1 };
    default:
      return base;
  }
}

export function flowKey(offerId: string) {
  return `sari_flow_${offerId}`;
}

export function flowLegacyKey(legacyId: number | string) {
  return `sari_flow_legacy_${legacyId}`;
}

/** Charge un parcours à partir d'un id UUID ou d'un legacyId (vitrine). */
/** Parcours par défaut appliqué à toute offre qui n'en a pas encore un. */
export function defaultFlow(): FlowStep[] {
  const personal = newStep('personal');
  personal.title = 'Vos informations';
  personal.instructions = '<p>Renseignez vos coordonnées afin que nous puissions vous recontacter.</p>';
  const cv = newStep('cv');
  cv.title = 'Votre CV';
  cv.instructions = '<p>Déposez votre CV au format PDF ou DOCX.</p>';
  const motivation = newStep('motivation');
  motivation.title = 'Votre motivation';
  motivation.instructions = '<p>Expliquez en quelques lignes pourquoi vous souhaitez rejoindre SARI Système.</p>';
  return [personal, cv, motivation];
}

export function loadFlowFor(legacyIdOrUuid: number | string): FlowStep[] {
  if (typeof window === 'undefined') return [];
  const direct = localStorage.getItem(flowKey(String(legacyIdOrUuid)));
  if (direct) { try { const p = JSON.parse(direct); if (Array.isArray(p) && p.length) return p; } catch { /* */ } }
  const legacy = localStorage.getItem(flowLegacyKey(legacyIdOrUuid));
  if (legacy) { try { const p = JSON.parse(legacy); if (Array.isArray(p) && p.length) return p; } catch { /* */ } }
  // Fallback : chaque offre affiche un parcours, même sans personnalisation admin.
  return defaultFlow();
}

export function templatesKey() {
  return 'sari_flow_templates';
}

export function loadFlow(offerId: string): FlowStep[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(flowKey(offerId));
    return raw ? (JSON.parse(raw) as FlowStep[]) : [];
  } catch {
    return [];
  }
}

export function saveFlow(offerId: string, steps: FlowStep[]) {
  localStorage.setItem(flowKey(offerId), JSON.stringify(steps));
}

/** Sauvegarde aussi sous la clé legacyId pour que la vitrine puisse retrouver le parcours. */
export function saveFlowLegacy(offerId: string, legacyId: number | string | null | undefined, steps: FlowStep[]) {
  saveFlow(offerId, steps);
  if (legacyId != null && String(legacyId) !== '') {
    localStorage.setItem(flowLegacyKey(legacyId), JSON.stringify(steps));
  }
}

export function loadTemplates(): FlowTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(templatesKey());
    return raw ? (JSON.parse(raw) as FlowTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveTemplates(templates: FlowTemplate[]) {
  localStorage.setItem(templatesKey(), JSON.stringify(templates));
}

/** Modèles par défaut proposés à la première utilisation. */
export function defaultTemplates(): FlowTemplate[] {
  const standard: FlowStep[] = [newStep('personal'), newStep('cv'), newStep('motivation'), newStep('experience')];
  const qualifie: FlowStep[] = [newStep('personal'), newStep('multiple'), newStep('test'), newStep('cv')];
  standard.forEach((s, i) => { s.title = ['Vos informations', 'Votre CV', 'Votre motivation', 'Votre expérience'][i]; });
  qualifie.forEach((s, i) => { s.title = ['Profil', 'Pré-requis', 'Test d’aptitude', 'CV'][i]; });
  return [
    { id: 'tpl-standard', label: 'Parcours standard', category: 'Général', steps: standard },
    { id: 'tpl-qualifie', label: 'Parcours qualifiant', category: 'Général', steps: qualifie },
  ];
}

export function ensureTemplates(): FlowTemplate[] {
  const existing = loadTemplates();
  if (existing.length) return existing;
  const def = defaultTemplates();
  saveTemplates(def);
  return def;
}

/** Score maximum possible d'un parcours (poids des étapes notées). */
export function flowMaxScore(steps: FlowStep[]): number {
  return steps.reduce((s, st) => s + (st.scoreWeight || 0), 0);
}

/** Progression candidat dans un parcours (étapes franchies horodatées). */
export interface FlowProgress {
  stepId: string;
  done: boolean;
  at?: string;
  answer?: string;
}

export function progressKey(offerId: string, applicationId: number) {
  return `sari_flow_progress_${offerId}_${applicationId}`;
}

export function loadProgress(offerId: string, applicationId: number): FlowProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(progressKey(offerId, applicationId));
    return raw ? (JSON.parse(raw) as FlowProgress[]) : [];
  } catch {
    return [];
  }
}

export function saveProgress(offerId: string, applicationId: number, progress: FlowProgress[]) {
  localStorage.setItem(progressKey(offerId, applicationId), JSON.stringify(progress));
}

/** Réponses du candidat (sauvegarde progressive de la vitrine). */
export function answersKey(offerId: string, applicationId: number) {
  return `sari_flow_answers_${offerId}_${applicationId}`;
}

export function loadAnswers(offerId: string, applicationId: number): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(answersKey(offerId, applicationId)) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveAnswers(offerId: string, applicationId: number, answers: Record<string, string>) {
  localStorage.setItem(answersKey(offerId, applicationId), JSON.stringify(answers));
}

/* ============================================================
   Analyse d'entonnoir (funnel) + progression candidat + reprise
   ============================================================ */

export interface FlowProgressRecord {
  applicationId: number;
  progress: FlowProgress[];
}

/** Énumère toutes les progressions enregistrées pour une offre (scan localStorage). */
export function listFlowProgress(offerId: string): FlowProgressRecord[] {
  if (typeof window === 'undefined') return [];
  const out: FlowProgressRecord[] = [];
  const prefix = `sari_flow_progress_${offerId}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const appId = Number(key.slice(prefix.length));
    if (!Number.isFinite(appId)) continue;
    try {
      out.push({ applicationId: appId, progress: JSON.parse(localStorage.getItem(key) || '[]') as FlowProgress[] });
    } catch { /* ignore */ }
  }
  return out;
}

export interface StepFunnel {
  stepId: string;
  title: string;
  reached: number;
  completed: number;
  abandoned: number;
  dropRate: number; // % des candidats partis à cette étape
}

/** Métriques d'entonnoir par étape (où les candidats abandonnent). */
export function flowFunnel(steps: FlowStep[], offerId: string): StepFunnel[] {
  const records = listFlowProgress(offerId);
  const total = records.length;
  return steps.map((step) => {
    const reached = records.filter((r) => r.progress.some((p) => p.stepId === step.id)).length;
    const completed = records.filter((r) => r.progress.some((p) => p.stepId === step.id && p.done)).length;
    const abandoned = reached - completed;
    return {
      stepId: step.id,
      title: step.title,
      reached,
      completed,
      abandoned,
      dropRate: total ? Math.round((abandoned / total) * 100) : 0,
    };
  });
}

export function flowCompletionRate(offerId: string, steps: FlowStep[]): number {
  const records = listFlowProgress(offerId);
  if (!records.length || !steps.length) return 0;
  const avg = records.reduce((s, r) => s + r.progress.filter((p) => p.done).length / steps.length, 0) / records.length;
  return Math.round(avg * 100);
}

export function resumeKey(offerId: string, applicationId: number) {
  return `sari_flow_resume_${offerId}_${applicationId}`;
}

export function generateResumeToken(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getResumeToken(offerId: string, applicationId: number): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(resumeKey(offerId, applicationId));
}

/** Retrouve (offerId, applicationId) à partir d'un jeton de reprise. */
export function findResumeByToken(token: string): { offerId: string; applicationId: number } | null {
  if (typeof window === 'undefined' || !token) return null;
  const prefix = 'sari_flow_resume_';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    if (localStorage.getItem(key) !== token) continue;
    // key = sari_flow_resume_<offerId>_<applicationId>
    const rest = key.slice(prefix.length);
    const idx = rest.lastIndexOf('_');
    if (idx < 0) continue;
    const offerId = rest.slice(0, idx);
    const applicationId = Number(rest.slice(idx + 1));
    if (Number.isFinite(applicationId)) return { offerId, applicationId };
  }
  return null;
}

/** Lien unique de reprise (à envoyer par email). Pointe vers la page publique /jobs. */
export function resumeUrl(
  offerId: string,
  applicationId: number,
  legacyId: number | string | null | undefined,
  locale = 'fr',
): string {
  const token = getResumeToken(offerId, applicationId) || generateResumeToken();
  localStorage.setItem(resumeKey(offerId, applicationId), token);
  const jobId = legacyId != null && String(legacyId) !== '' ? String(legacyId) : offerId;
  return `/${locale}/jobs/${jobId}?resume=${token}`;
}

/** Seed une progression de démo pour rendre le funnel et les timelines visibles. */
export function ensureDemoFlowProgress(offerId: string, steps: FlowStep[], applicationIds: number[]): void {
  if (typeof window === 'undefined') return;
  if (listFlowProgress(offerId).length) return;
  applicationIds.forEach((appId, idx) => {
    // Chaque candidat avance plus ou moins loin (idx % 3 → niveau d'abandon)
    const stopAt = steps.length - (idx % 3);
    const progress: FlowProgress[] = steps.map((step, i) => ({
      stepId: step.id,
      done: i < stopAt,
      at: i < stopAt ? new Date(Date.now() - (steps.length - i) * 86_400_000).toISOString() : undefined,
    }));
    saveProgress(offerId, appId, progress);
  });
}
