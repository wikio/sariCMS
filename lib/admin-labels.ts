// lib/admin-labels.ts
'use client';

/**
 * Libellés traduits de l'admin (titres de sections + labels de champs).
 *
 * Historiquement chaque module lisait `admin.careersFields`, ce qui donnait
 * des libellés faux (« Intitulé du poste » pour une solution) ou non traduits
 * quand la clé n'existait pas. Tout passe désormais par `admin.fields` :
 *
 *   admin.fields._groups.<Groupe>   → nom de section traduit
 *   admin.fields.<module>.<champ>   → libellé spécifique au module
 *   admin.fields.<champ>            → libellé commun (fallback)
 *
 * En dernier recours on retombe sur le libellé FR défini dans cms-modules.ts,
 * ce qui garantit qu'aucune clé brute ne s'affiche jamais à l'écran.
 */

import { useMessages } from 'next-intl';
import { useCallback, useMemo } from 'react';

type Dict = Record<string, unknown>;

function asDict(value: unknown): Dict | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export interface AdminLabels {
  /** Nom traduit d'un groupe de champs (section du formulaire). */
  group: (group: string) => string;
  /** Libellé traduit d'un champ, en tenant compte du module. */
  field: (key: string, fallback?: string) => string;
  /** Aide contextuelle traduite (`hint<Champ>`), si définie. */
  hint: (key: string, fallback?: string) => string | undefined;
}

export function useAdminLabels(moduleKey?: string): AdminLabels {
  const messages = useMessages() as Dict;

  const { fields, moduleFields, groups, legacy } = useMemo(() => {
    const admin = asDict(messages?.admin) || {};
    const f = asDict(admin.fields) || {};
    return {
      fields: f,
      moduleFields: (moduleKey && asDict(f[moduleKey])) || {},
      groups: asDict(f._groups) || {},
      // Anciens namespaces conservés pour ne rien perdre des traductions déjà saisies.
      legacy: [
        (moduleKey && asDict(admin[`${moduleKey}Fields`])) || null,
        asDict(admin.careersFields),
      ].filter(Boolean) as Dict[],
    };
  }, [messages, moduleKey]);

  const group = useCallback(
    (name: string) => {
      if (!name) return '';
      return asText(groups[name]) || asText(groups[name.trim()]) || name;
    },
    [groups],
  );

  const field = useCallback(
    (key: string, fallback?: string) => {
      if (!key) return fallback || '';
      const direct = asText(moduleFields[key]) || asText(fields[key]);
      if (direct) return direct;
      for (const dict of legacy) {
        const found = asText(dict[key]);
        if (found) return found;
      }
      return fallback || key;
    },
    [fields, moduleFields, legacy],
  );

  const hint = useCallback(
    (key: string, fallback?: string) => {
      if (!key) return fallback;
      const hintKey = `hint${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      const direct = asText(moduleFields[hintKey]) || asText(fields[hintKey]);
      if (direct) return direct;
      for (const dict of legacy) {
        const found = asText(dict[hintKey]);
        if (found) return found;
      }
      return fallback;
    },
    [fields, moduleFields, legacy],
  );

  return { group, field, hint };
}
