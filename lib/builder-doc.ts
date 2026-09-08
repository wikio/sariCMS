/**
 * Le document produit par le constructeur de page, et sa place dans les données.
 *
 * Une page « Constructeur » (module Pages CMS, mise en page `constructor`) stocke
 * sa construction **dans son propre champ `content`**, celui que la vitrine sait
 * déjà rendre : un préambule `<style>` porté par le constructeur pour le CSS de
 * la page, puis le HTML. Rien d'autre n'est ajouté au schéma — ni colonne, ni
 * migration — et la page reste lisible et modifiable par les chemins existants
 * (formulaire du module, reprise de données, export), parce que `content` reste
 * du HTML.
 *
 * Le préambule est le **premier** bloc `<style>` du document : un style écrit à la
 * main plus bas dans la page n'est pas touché, et le constructeur n'écrase que ce
 * qu'il a lui-même posé. C'est un aller-retour pur, sans dépendance : il sert
 * aussi bien au constructeur (côté client) qu'au rendu de la page (côté serveur).
 */

export interface BuilderDoc {
  /** HTML de la page, sans le style du constructeur. */
  html: string;
  /** CSS propre à la page (sortie du constructeur). */
  css: string;
}

const LEADING_STYLE = /^\s*<style(?:\s[^>]*)?>([\s\S]*?)<\/style>\s*/i;

/** `content` d'une page → { html, css }. Un contenu sans préambule est du HTML brut. */
export function decodeBuilderDoc(content: unknown): BuilderDoc {
  const raw = String(content ?? '');
  const match = LEADING_STYLE.exec(raw);
  if (!match) return { html: raw.trim(), css: '' };
  return { html: raw.slice(match[0].length).trim(), css: (match[1] || '').trim() };
}

/** { html, css } → `content` d'une page. Un CSS vide ne laisse pas une balise vide. */
export function encodeBuilderDoc(doc: Partial<BuilderDoc> | undefined | null): string {
  const html = String(doc?.html ?? '').trim();
  const css = String(doc?.css ?? '').replace(/<\/style>/gi, '').trim();
  if (!css) return html;
  // Le style est replié sur une ligne et balisé d'un commentaire : sans lui, une
  // relecture du champ ne pourrait pas dire si le préambule vient du
  // constructeur (à remplacer) ou d'un auteur (à laisser tranquille).
  return `<style data-sari-builder="1">\n${css}\n</style>\n${html}`;
}

/** Le document a-t-il de quoi être rendu (une page vide n'est pas une page). */
export function hasBuilderDoc(doc: BuilderDoc | undefined | null): boolean {
  const html = String(doc?.html ?? '').trim();
  // Une page constituée d'un seul conteneur vide ne vaut rien : GrapesJS laisse
  // parfois un `<div></div>` après une suppression complète.
  return html.replace(/<[^>]*>/g, '').trim().length > 0 || /<(img|video|iframe|picture|svg)\b/i.test(html);
}

/** Marqueur du préambule posé par le constructeur. */
export const BUILDER_STYLE_FLAG = 'data-sari-builder';

/** Le style préfixe vient-il du constructeur (et peut-il être remplacé) ? */
export function hasBuilderStyleFlag(content: unknown): boolean {
  const raw = String(content ?? '').trimStart();
  const head = raw.slice(0, 200).toLowerCase();
  return head.startsWith('<style') && head.includes(BUILDER_STYLE_FLAG);
}
