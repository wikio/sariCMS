/**
 * lib/ged/http.ts — ce que les routes de la GED ont en commun.
 *
 * Trois choses, et elles doivent être les mêmes partout : la traduction d'une erreur
 * du magasin en code HTTP, la lecture des champs partagés entre `multipart/form-data`
 * (l'upload d'un Blob depuis la retouche) et JSON (l'export depuis l'atelier), et le
 * décodage d'un état éditable — qui, lui, a le droit d'être illisible sans empêcher
 * l'écriture du visuel : perdre un PNG parce que son JSON est tronqué serait pire que
 * l'inverse.
 */

import { NextResponse } from 'next/server';
import { GedStoreError } from '@/lib/ged/store.mjs';

/** Les origines d'un asset, telles qu'elles sont écrites dans les fiches. */
export const GED_ORIGINS = ['builder', 'atelier', 'media', 'import'] as const;

/** Un avertissement lisible par un humain, pas une stack. */
export function failure(error: unknown, label: string) {
  if (error instanceof GedStoreError) {
    const status =
      error.code === 'INTROUVABLE'
        ? 404
        : error.code === 'EXISTANT'
          ? 409
          : error.code === 'TROP_LOURD'
            ? 413
            : 400;
    return NextResponse.json({ error: `${label} — ${error.message}`, code: error.code }, { status });
  }
  console.error(`[GED] ${label}:`, error);
  return NextResponse.json({ error: `${label}.` }, { status: 500 });
}

/** Une liste arrivée en chaîne séparée (`tags=a,b`) ou en tableau. */
export function splitList(value: unknown, limit = 24) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((tag) => String(tag).trim()).filter(Boolean).slice(0, limit);
}

/** Un nombre, ou 0 — les écrans envoient des chaînes vides pour « non renseigné ». */
export function numberField(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

/** Une chaîne courte, bornée : un manifeste doit rester lisible d'un coup d'œil. */
export function textField(value: unknown, max: number, fallback = '') {
  const raw = value == null ? '' : String(value).trim();
  return (raw || fallback).slice(0, max);
}

/** D'où vient l'asset : la page, le composant, le champ qui l'a demandé. */
export function sourceFrom(pick: (key: string) => unknown) {
  const origin = String(pick('origin') || '');
  return {
    origin: (GED_ORIGINS.includes(origin as (typeof GED_ORIGINS)[number]) ? origin : 'atelier') as (typeof GED_ORIGINS)[number],
    pageId: textField(pick('pageId'), 40),
    pageSlug: textField(pick('pageSlug'), 160),
    componentId: textField(pick('componentId'), 60),
    field: textField(pick('field'), 60),
  };
}

/** L'état éditable, en tolérant un JSON tronqué. */
export function readState(value: unknown): unknown | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

/** Un `data:` URL (ou une URL relative déjà chargée) en Buffer. */
export async function bufferFromDataUrl(dataUrl: unknown, limit: number): Promise<Buffer | null> {
  const raw = typeof dataUrl === 'string' ? dataUrl.trim() : '';
  if (!raw) return null;
  const comma = raw.indexOf(',');
  if (!raw.startsWith('data:') || comma < 0) return null;
  const meta = raw.slice(5, comma);
  const body = raw.slice(comma + 1);
  const buffer = meta.includes('base64') ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8');
  if (buffer.length > limit) return null;
  return buffer;
}

/** L'extension déclarée par un `data:` URL, ou rien si l'écran ne l'a pas mise. */
export function extensionFromDataUrl(dataUrl: unknown) {
  const raw = typeof dataUrl === 'string' ? dataUrl : '';
  const match = /^data:([a-z+-]+\/[a-z0-9.+-]+)/i.exec(raw);
  if (!match) return '';
  const mime = match[1].toLowerCase();
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return '';
}
