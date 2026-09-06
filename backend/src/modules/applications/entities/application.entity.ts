import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

export interface ApplicationEntity extends BaseEntity {
  reference?: string | null;
  /** Compte candidat rattaché (users.id). Null si candidature sans compte. */
  userId?: number | null;
  /** Offre d'emploi visée (careers.id). */
  careerId?: number | null;
  candidate: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  status: string;
  date: Date | string;
  experience?: string | null;
  motivation?: string | null;
  rating?: number | null;
  score?: number | null;
  note?: string | null;
  /** URL du CV téléversé. */
  cv?: string | null;
  /** URL de la lettre de motivation. */
  lm?: string | null;
  history?: Array<{ status: string; at: string; note?: string }> | unknown;
}
