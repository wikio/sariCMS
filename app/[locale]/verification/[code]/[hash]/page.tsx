/**
 * app/[locale]/verification/[code]/[hash]/page.tsx — le lien du QR.
 *
 * `/{locale}/verification/SARI-FAC24-00001/CTdxXe6ZdFVzWQ%3D%3D` : le code du
 * document et sa clé de vérification voyagent dans le chemin, que le lecteur de
 * QR recopie sans poser de question. Les deux champs de la page sont
 * pré-remplis et le focus va au captcha : le scanner n'a plus qu'à prouver
 * qu'il est humain, pas à recoller des bouts de texte.
 *
 * Rien ici ne « valide » l'existence des segments : un code inconnu tombe sous
 * le jugement du serveur de vérification (`INTROUVABLE`), et la page l'affiche
 * en français — filtrer les chemins à l'entrée créerait deux messages pour la
 * même absence.
 *
 * La page reste ouverte sans rien : `/verification` est le même écran, champs
 * vides, frappe manuelle.
 */
import VerificationExperience from '@/components/verification/VerificationExperience';
import { decodeSegmentParam } from '@/lib/verification-link';

export const dynamic = 'force-dynamic';

export default async function VerificationCodeHashPage(props: {
  params: Promise<{ code: string; hash: string }>;
}) {
  const params = await props.params;
  const code = decodeSegmentParam(params.code);
  const hash = decodeSegmentParam(params.hash);
  return <VerificationExperience initialCode={code} initialHash={hash} fromQr={Boolean(code && hash)} />;
}
