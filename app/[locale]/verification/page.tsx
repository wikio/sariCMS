/**
 * app/[locale]/verification/page.tsx — la page publique de vérification.
 *
 * Deux entrées, un seul écran :
 *
 *   /{locale}/verification                  — l'utilisateur saisit lui-même ;
 *   /{locale}/verification?code=…&key=…     — les liens historiques du QR ;
 *   /{locale}/verification/{code}/{hash}    — le lien court (voir le segment [code]).
 *
 * Ce fichier ne fait que lire l'URL ; toute l'interface vit dans
 * `components/verification/VerificationExperience.tsx`, partagée avec la forme à
 * segments — un seul endroit où changer le parcours, deux manières d'entrer.
 */
import VerificationExperience from '@/components/verification/VerificationExperience';
import { decodeSegmentParam } from '@/lib/verification-link';

export const dynamic = 'force-dynamic';

export default async function VerificationPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  // `key` est le nom historique du paramètre ; `hash` est celui de l'API externe.
  const code = decodeSegmentParam(sp.code);
  const hash = decodeSegmentParam(sp.hash) || decodeSegmentParam(sp.key);
  return <VerificationExperience initialCode={code} initialHash={hash} fromQr={Boolean(code && hash)} />;
}
