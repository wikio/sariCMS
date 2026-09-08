/**
 * lib/canvas/history.ts — la pile d'annulation de l'atelier.
 *
 * Un « aller-retour » dans un éditeur de canvas coûte cher pour une raison simple :
 * la seule façon fiable de revenir en arrière est de rejouer l'état complet du
 * document. Cinquante objets bien remplis, c'est un demi-mégaoctet par capture, et
 * soixante captures à garder en mémoire font un onglet qui rame. Cette file est donc
 * bornée deux fois : par le nombre d'entrées et par le volume total, et elle fusionne
 * les modifications continues.
 *
 * Ce module ne connaît ni Fabric ni le DOM : il manipule des chaînes JSON. C'est ce
 * qui le rend testable à plat, et réutilisable si un autre éditeur du projet a besoin
 * des mêmes règles.
 */

import { HISTORY_COALESCE_MS, HISTORY_LIMIT, pushHistory, type HistoryEntry } from '@/lib/canvas/document';

/** Le volume total gardé en mémoire (8 Mo) : au-delà, on oublie les plus anciennes. */
export const HISTORY_BUDGET_BYTES = 8 * 1024 * 1024;

export interface History {
  /** Une modification vient d'avoir lieu : `json` est l'état À PRÉSENTER après. */
  commit(label: string, json: string): void;
  /** L'état à rejouer pour revenir en arrière, ou `null` si on est au début. */
  undo(next: string): string | null;
  /** L'état à rejouer pour recommencer. */
  redo(previous: string): string | null;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Ce que la barre d'outils affiche : profondeur et futur. */
  stats(): { past: number; future: number; bytes: number; limit: number };
  /** Un nouveau document repart de zéro. */
  reset(json?: string): void;
  /** Le dernier état connu — l'autosauvegarde s'en contente, sans rescanner le canvas. */
  peek(): string | null;
}

/**
 * @param baseline l'état initial du document, considéré comme « zéro historique »
 */
export function createHistory(baseline = '', limit = HISTORY_LIMIT, budget = HISTORY_BUDGET_BYTES): History {
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];
  let current: HistoryEntry | null = baseline ? { label: 'ouverture', at: Date.now(), snapshot: baseline } : null;

  const bytes = () => past.reduce((sum, entry) => sum + entry.snapshot.length, 0) + (current?.snapshot.length || 0) + future.reduce((sum, entry) => sum + entry.snapshot.length, 0);

  /** Le plafond de volume prime sur le plafond d'entrées : 60 captures de 2 Mo ne passent pas. */
  function trim() {
    while (past.length > limit) past.shift();
    while (past.length > 1 && bytes() > budget) past.shift();
  }

  return {
    commit(label, json) {
      const entry: HistoryEntry = { label, at: Date.now(), snapshot: json };
      if (current) {
        past = pushHistory(past, current, limit);
        trim();
      }
      current = entry;
      future = [];
    },
    undo(next) {
      if (!past.length) return null;
      const present: HistoryEntry = { label: 'état courant', at: Date.now(), snapshot: next };
      future = [present, ...future].slice(0, limit);
      current = past.pop() || null;
      past = [...past];
      return current?.snapshot ?? null;
    },
    redo(previous) {
      if (!future.length) return null;
      const [present, ...rest] = future;
      future = rest;
      if (previous) past = pushHistory(past, { label: 'état courant', at: Date.now(), snapshot: previous }, limit);
      current = present;
      trim();
      return current.snapshot;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    stats: () => ({ past: past.length, future: future.length, bytes: bytes(), limit }),
    reset(json) {
      past = [];
      future = [];
      current = json ? { label: 'ouverture', at: Date.now(), snapshot: json } : null;
    },
    peek: () => current?.snapshot ?? null,
  };
}

/** Deux entrées successives portant le même nom ne comptent qu'une fois (frappe, slider). */
export function shouldCoalesce(previous: HistoryEntry | null | undefined, label: string, at: number) {
  return Boolean(previous && previous.label === label && at - previous.at < HISTORY_COALESCE_MS);
}
