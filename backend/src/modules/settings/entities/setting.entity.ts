import { BaseEntity } from '../../../common/crud/interfaces/repository.interface';

/**
 * Réglage générique : une clé unique, une valeur JSON, un groupe de
 * rattachement. Sert notamment à la visibilité de la vitrine, enregistrée
 * sous les clés `visibility.<langue>`.
 */
export interface SettingEntity extends BaseEntity {
  key: string;
  value: unknown;
  group: string;
}
