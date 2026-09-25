import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';

/**
 * Règlages d'écran mis en base sous forme de document JSON.
 *
 * Pourquoi un document et pas une table par réglage : ces objets sont relus en
 * bloc par un écran, modifiés en bloc, et n'ont aucune valeur relationnelle —
 * pas de jointure, pas de requête partielle, pas d'historique. Une table par
 * objet ici, ce serait cinq modèles, cinq migrations et cinq écrans pour le
 * même service rendu. Les données qui *sont* relationnelles (paiements encaissés,
 * utilisations de coupons) ne passent pas par là : elles exigent des lignes.
 *
 * Pourquoi la table `settings` et pas le `localStorage` : ces réglages pilotent
 * la vitrine publique (formats de dates, message de réapprovisionnement, formats
 * de codes, zones de livraison) et l'écriture des écrans d'administration. En
 * `localStorage`, ils ne valaient que pour le navigateur de qui les avait
 * saisis — le visiteur voyait l'autre format, un second administrateur générait
 * des numéros dans un autre ordre, et un changement de poste effaçait tout.
 *
 * Le magasin est borné par une liste blanche, `DOC_SPECS`. Il refuse toute clé
 * inconnue et, pour chaque clé, tout champ non listé. Un écran ne peut donc pas,
 * même par accident ou par requête fabriquée, faire atterrir ici ce qui n'y a
 * rien à faire.
 */

/** Taille maximale acceptée, une fois sérialisée. Un écran ne pèse pas 256 Ko. */
const MAX_DOCUMENT_BYTES = 256 * 1024;

type DocSpec =
  /** Objet : seuls les champs listés sont conservés. */
  | { shape: 'fields'; fields: readonly string[] }
  /**
   * Tableau : stocké sous `{ items: [...] }`, présenté au client comme une liste.
   *
   * `itemStrip` retire un champ de CHAQUE ligne avant stockage, puis avant
   * relecture — deux fois, parce que la base contient déjà le champ des lignes écrites avant cette règle : la
   * projection à la sortie est ce qui garantit qu'un secret ne ressort jamais,
   * même d'une ligne antérieure à cette règle.
   */
  | { shape: 'array'; itemStrip?: readonly string[] }
  /**
   * Objet à clés libres, toutes conservées. Réservé aux magasins indexés par une
   * clé que le serveur n'a pas à connaître — les taxonomies sont indexées par
   * taxon (`partner-categories`, …), et le jeu de taxons est extensible depuis
   * l'écran. Une liste blanche y serait un piège : elle viderait silencieusement
   * toute clé oubliée de la liste, ce qui est exactement la perte de données
   * qu'on cherche à éviter. La validité des valeurs est en revanche contrôlée.
   */
  | { shape: 'record' };

/**
 * Clés admises et ce qu'on en garde.
 *
 * Les listes blanches sont des garde-fous, pas de la paresse :
 *
 * - `admin` vient de `sari_admin_settings`, qui contient aussi `smtp` (mot de
 *   passe), `erp` (clé d'API) et `db.url` (URL de connexion avec identifiants).
 *   Les copier dans MySQL les rendrait lisibles par toute sauvegarde de la base.
 *   Ils restent donc côté navigateur, et l'écran le dit. Le vrai SMTP est déjà
 *   ailleurs et bien : `backend/storage/mail/smtp.json`, fichier serveur, hors
 *   base — la copie dans les réglages d'écran n'est lue par personne.
 * - `siteLogo` est absent de `admin` : le logo de la vitrine est enregistré dans
 *   `ContactInfo.logo`, la seule valeur que le rendu serveur de l'en-tête lit.
 *   Un réglage par navigateur ne peut pas constituer le logo d'un visiteur.
 * - `shop.importApi` est exclu pour la même raison que `erp` : son sous-champ
 *   `apiKey` est une clé secrète.
 * - `currencies` et `payments` sont des listes nues côté écran ; l'enveloppe
 *   `{ items }` n'existe qu'en base, pour que la colonne `value` garde une forme
 *   d'objet exploitable par le reste du système (corbeille, purge, audit).
 */
export const DOC_SPECS: Record<string, DocSpec> = {
  admin: {
    shape: 'fields',
    fields: [
      'defaultLocale',
      'dates',
      'skuFormat',
      'cropWidth',
      'cropHeight',
      'restockMessage',
      'requireAuthToApply',
      'security',
      'codes',
      'quote',
      'invoicing',
    ],
  },
  shop: {
    shape: 'fields',
    fields: [
      'currency',
      'shipping',
      'globalDiscount',
      'saleConditions',
      'deliveryNotes',
      'saleZones',
      'deliveryZones',
      'globalTaxId',
    ],
  },
  taxonomies: { shape: 'record' },
  currencies: { shape: 'array' },
  payments: { shape: 'array', itemStrip: ['apiKey'] },
  /*
   * Gabarits de messages de notification. Ce ne sont PAS les textes du centre de
   * messagerie (`data/mail/`, déjà sur le serveur et laissés tels quels) : cette
   * liste-là n'avait d'autre copie que le `localStorage` du poste, alors que
   * l'écran la remplace en bloc à chaque enregistrement — la forme même d'un
   * document, et non d'un journal.
   *
   * Aucun champ n'en est retiré : nom, déclencheur, objet, corps, actif, locale.
   * Rien de confidentiel, et le corps est du HTML destiné au client.
   */
  notify: { shape: 'array' },
};

export const DOC_KINDS = Object.keys(DOC_SPECS);

export function isDocKind(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(DOC_SPECS, value);
}

interface SettingRow extends BaseEntity {
  key?: string;
  value?: unknown;
  group?: string;
}

export interface DocStatus {
  kind: string;
  /** `null` quand rien n'est enregistré : l'écran garde ses défauts. */
  document: Record<string, unknown> | null;
  /** Tableau nu pour les clés de forme `array`, sinon l'objet projeté. */
  payload: unknown;
  /** La liste est-elle vide *en base*, ou absente ? Distinction utile à l'écran. */
  source: 'db' | 'default';
}

/** Réduit un objet à la liste blanche de sa clé. Les autres champs tombent. */
/**
 * Deux directions, et les confondre détruit des données.
 *
 * `fromClient` reçoit ce que l'écran envoie : une liste **nue** pour une clé
 * `array`. `fromStored` relit ce que la base contient : l'**enveloppe** `{items}`.
 * Faire passer l'enveloppe par la projection client la réduirait à `{items:[]}` —
 * un tableau qui n'en est pas un — et l'écran, persuadé que la base est vide,
 * écrirait `[]` dans son cache : la liste de l'opérateur effacée par un simple
 * rechargement. C'est le défaut corrigé pour les coupons, réapparu ici sous une
 * autre forme, et qu'un test attrape désormais.
 */
function fromClient(spec: DocSpec, input: unknown): Record<string, unknown> {
  if (spec.shape === 'array') {
    return { items: scrubItems(spec, input) };
  }
  return project(spec, input);
}

function fromStored(spec: DocSpec, value: unknown): Record<string, unknown> {
  if (spec.shape === 'array') {
    return { items: scrubItems(spec, (value as { items?: unknown }).items) };
  }
  return project(spec, value);
}

/**
 * Retire de chaque ligne les champs qui ne quittent pas le navigateur.
 *
 * Le champ est retiré à l'entrée ET à la sortie, et la sortie n'est pas un détail
 * : `payments` porte un `apiKey` par mode, déjà présent dans les documents écrits
 * avant cette règle. Ne filtrer que l'écriture laisserait la clé resortir d'une
 * sauvegarde de la base vers un poste — soit exactement ce qu'on refuse.
 */
function scrubItems(spec: DocSpec, input: unknown): unknown[] {
  const rows = Array.isArray(input) ? input : [];
  const strip = spec.shape === 'array' ? (spec.itemStrip ?? []) : [];
  if (!strip.length) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const field of strip) delete out[field];
    return out;
  });
}

function project(spec: DocSpec, input: unknown): Record<string, unknown> {
  const source = (
    input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  ) as Record<string, unknown>;
  if (spec.shape === 'record') {
    // Une valeur qui n'est pas une liste de termes est écartée plutôt que
    // stockée : l'écran la relirait dans une forme qu'il ne sait pas afficher.
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      if (Array.isArray(v)) out[k] = v;
    }
    return out;
  }
  // `array` est traité par `fromClient` / `fromStored`, qui connaissent
  // l'enveloppe ; ici on ne projette que les formes à objet.
  if (spec.shape === 'fields') {
    const out: Record<string, unknown> = {};
    for (const field of spec.fields) {
      if (source[field] !== undefined) out[field] = source[field];
    }
    return out;
  }
  return {};
}
@Injectable()
export class SettingsDocsService {
  private readonly logger = new Logger(SettingsDocsService.name);

  constructor(@Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory) {}

  private repo() {
    // `COLLECTIONS.settings` porte déjà la marque et la visibilité : un seul
    // registre de réglages, une seule purge de corbeille, une seule sauvegarde.
    return this.factory<SettingRow>(COLLECTIONS.settings);
  }

  private spec(kind: string): DocSpec {
    if (!isDocKind(kind)) throw new BadRequestException(`réglage inconnu: ${kind}`);
    return DOC_SPECS[kind];
  }

  /** Document enregistré, réduit à la liste blanche, ou null si absent. */
  async read(kind: string): Promise<Record<string, unknown> | null> {
    const spec = this.spec(kind);
    const key = `doc_${kind}`;
    try {
      const row = await this.repo().findOne({ key }, true);
      const value = row?.value;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      return fromStored(spec, value);
    } catch (err) {
      // Base non migrée, table absente : l'administration doit quand même ouvrir.
      this.logger.warn(`lecture du réglage ${kind}: ${(err as Error).message}`);
      return null;
    }
  }

  async status(kind: string): Promise<DocStatus> {
    const spec = this.spec(kind);
    const document = await this.read(kind);
    return {
      kind,
      document,
      payload: spec.shape === 'array' ? scrubItems(spec, document?.items ?? []) : document,
      source: document ? 'db' : 'default',
    };
  }

  /**
   * Accepte `{…}` pour une clé `fields`, un tableau nu pour une clé `array`.
   * L'écran n'a pas à connaître l'enveloppe : c'est un détail de stockage.
   */
  async save(kind: string, input: unknown): Promise<DocStatus> {
    const spec = this.spec(kind);
    if (spec.shape === 'array' && !Array.isArray(input)) {
      throw new BadRequestException(`${kind}: un tableau est attendu`);
    }
    if (spec.shape !== 'array' && (!input || typeof input !== 'object' || Array.isArray(input))) {
      throw new BadRequestException(`${kind}: un objet JSON est attendu`);
    }
    const document = fromClient(spec, input);
    const size = JSON.stringify(document).length;
    if (size > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException(`${kind}: document de ${size} octets, maximum ${MAX_DOCUMENT_BYTES}`);
    }
    const key = `doc_${kind}`;
    const existing = await this.repo().findOne({ key }, true);
    if (existing?.id) {
      await this.repo().update(existing.id, { value: document } as Partial<SettingRow>);
    } else {
      await this.repo().create({ key, value: document, group: 'settings-doc' } as Partial<SettingRow>);
    }
    return this.status(kind);
  }

  /** Supprime le document : l'écran revient à ses défauts. */
  async reset(kind: string): Promise<DocStatus> {
    const key = `doc_${kind}`;
    const existing = await this.repo().findOne({ key }, true);
    if (existing?.id) await this.repo().hardDelete(existing.id);
    return this.status(kind);
  }
}
