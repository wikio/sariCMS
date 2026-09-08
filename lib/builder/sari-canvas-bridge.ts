/**
 * Le pont entre GrapesJS et l’atelier graphique.
 *
 * GrapesJS est chargé dynamiquement (`await import('grapesjs')`) et n’apporte pas de
 * types ; l’atelier, lui, est du React monté dans la page. Les deux ne se connaissent
 * pas : ils se parlent par ce petit journal d’événements, ce qui évite deux choses :
 *
 * - qu’un module GrapesJS importe du React (et se retrouve à tirer `react-dom` dans le
 *   bundle de l’éditeur) ;
 * - que la page d’administration doive savoir quels traits ou quel type de composant le
 *   plugin a enregistrés pour les faire vivre.
 *
 * Le pont est mince : une requête, une réponse. `openStudio` renvoie une promesse que
 * l’hôte (`CanvasStudioHost`) résout avec la référence GED de la planche, ou `null` si
 * l’utilisateur a fermé sans enregistrer. Un composant de page ne doit jamais garder un
 * état « modifié sans sauvegarde » : soit il pointe sur un asset, soit il ne pointe sur
 * rien.
 */

/** Ce que l’atelier doit ouvrir, et pourquoi. */
export type StudioPurpose = 'edit' | 'new' | 'retouch' | 'replace';

export interface StudioRequest {
  /** Corrélation de la réponse : deux fenêtres ne se marchent pas dessus. */
  id: string;
  purpose: StudioPurpose;
  /** Le composant de page appelant, quand la demande vient d’un bloc. */
  componentId?: string;
  pageId?: string;
  pageSlug?: string;
  /** La planche de la GED à rejouer (`module/fichier`). */
  file?: string;
  /** Une image à retoucher : sa source actuelle suffit à l’atelier. */
  url?: string;
  alt?: string;
  width?: number;
  height?: number;
  /** Un gabarit du catalogue, pour démarrer dessus. */
  templateId?: string;
}

/** Ce que l’atelier rend à la page : la référence de l’asset écrit. */
export interface StudioReply {
  file: string;
  url: string;
  kind?: string;
  prefix?: string;
  width: number;
  height: number;
  version?: number;
  alt?: string;
}

/** La donnée que GrapesJS passe quand il veut ouvrir son sélecteur d’actifs. */
export interface AssetBridgeRequest {
  container: HTMLElement | null;
  types: string[];
  options: Record<string, unknown>;
  close: () => void;
  select: (asset: { src: string; name?: string; type?: string; preview?: string }, complete: boolean) => void;
}

/** Ce que l'hote du selecteur d'actifs recoit : l'ouverture (avec le conteneur ou
 * rendre) ou la fermeture (pour demonter le portail). */
export type AssetsEvent = { type: 'open'; request: AssetBridgeRequest } | { type: 'close' };

type StudioListener = (request: StudioRequest) => void;
type AssetsListener = (event: AssetsEvent) => void;

const studioListeners = new Set<StudioListener>();
const assetsListeners = new Set<AssetsListener>();
const pending = new Map<string, (reply: StudioReply | null) => void>();
let counter = 0;

export const canvasBridge = {
  /** L’hôte s’inscrit ici. Le désabonnement est impératif : la page se remonte à chaque changement de page. */
  onStudio(listener: StudioListener): () => void {
    studioListeners.add(listener);
    return () => {
      studioListeners.delete(listener);
    };
  },
  onAssets(listener: AssetsListener): () => void {
    assetsListeners.add(listener);
    return () => {
      assetsListeners.delete(listener);
    };
  },
  openStudio(request: Omit<StudioRequest, 'id'>): Promise<StudioReply | null> {
    const id = `requete-${++counter}`;
    return new Promise<StudioReply | null>((resolve) => {
      const settle = (reply: StudioReply | null) => {
        pending.delete(id);
        resolve(reply);
      };
      pending.set(id, settle);
      // Personne n’écoute (atelier pas monté, page en cours de chargement) : on rend
      // `null` tout de suite plutôt que de laisser un bouton qui ne répond plus.
      if (!studioListeners.size) {
        settle(null);
        return;
      }
      for (const listener of studioListeners) listener({ ...request, id });
    });
  },
  resolveStudio(id: string, reply: StudioReply | null) {
    const settle = pending.get(id);
    pending.delete(id);
    settle?.(reply);
  },
  openAssets(request: AssetBridgeRequest): boolean {
    if (!assetsListeners.size) {
      // Sans hôte React, le sélecteur personnalisé de GrapesJS resterait vide : on
      // rend le contrôle à la fenêtre native de l’éditeur, qui sait se débrouiller.
      request.close();
      return false;
    }
    for (const listener of assetsListeners) listener({ type: 'open', request });
    return true;
  },
  /** GrapesJS ferme son sélecteur : l’hôte doit démonter, sinon le portail reste pendu. */
  closeAssets() {
    for (const listener of assetsListeners) listener({ type: 'close' });
  },
};

/** Le nombre de fenêtres d’atelier encore ouvertes — utile au test de non-régression. */
export function pendingStudioRequests(): number {
  return pending.size;
}
