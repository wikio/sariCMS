/**
 * app/[locale]/verification/[code]/page.tsx — le QR qui ne porte que le code.
 *
 * Tous les émetteurs n'embarquent pas la clé dans le lien : certains QR ne
 * portent que `/{locale}/verification/{code}`, et la clé se lit sur le document
 * lui-même, au bas de la facture. Sans cette route, le lien à un segment
 * tombait sur la 404 du site — une « erreur dans la page » pour l'utilisateur,
 * alors qu'il tient déjà la moitié de la réponse.
 *
 * Le code pré-remplit son champ, le champ de la clé reste vide, et c'est le
 * formulaire qui le réclamera (à l'écran, avant même l'appel serveur) — pas une
 * page blanche.
 */
import VerificationExperience from '@/components/verification/VerificationExperience';
import { decodeSegmentParam } from '@/lib/verification-link';

export const dynamic = 'force-dynamic';

export default async function VerificationCodeOnlyPage(props: {
  params: Promise<{ code: string }>;
}) {
  const params = await props.params;
  const code = decodeSegmentParam(params.code);
  return <VerificationExperience initialCode={code} fromQr={Boolean(code)} />;
}
