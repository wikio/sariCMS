/** Captcha → tri Nest (clé interne + JWT vitrine facultatif) → effets des seules demandes acceptées. */
import { after, NextRequest, NextResponse } from 'next/server';
import { isSubject, isSingleMailbox, type IntakeResult } from '@/backend/src/modules/contact/contact-contract';
import { forwardedIp } from '@/lib/server/cms-or';
import { internalPost } from '@/lib/server/internal-api';
import { subscribeFromForm } from '@/lib/server/newsletter-subscribe';
import { rateLimited, verifyCaptcha } from '@/lib/contact-captcha';
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (code: string, status: number) => NextResponse.json({ ok: false, code }, { status });
const received = () => NextResponse.json({ ok: true });

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('fields', 400);
  if (String(body.website || '').trim()) return received();
  if (rateLimited(forwardedIp(req), 6)) return fail('rate', 429);

  const text = (key: string) => {
    const value = body[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const name = text('name'),
    email = text('email').toLowerCase(),
    phone = text('phone'),
    company = text('company');
  const subject = text('subject'),
    message = text('message'),
    locale = text('locale') || 'fr';
  if (
    name.length < 2 ||
    name.length > 120 ||
    !isSingleMailbox(email) ||
    phone.length > 40 ||
    company.length > 160 ||
    !isSubject(subject) ||
    message.length < 10 ||
    message.length > 4000 ||
    !['fr', 'en', 'ar'].includes(locale)
  )
    return fail('fields', 400);
  if (!verifyCaptcha(text('captchaId'), text('captchaAnswer'))) return fail('captcha', 400);

  const outcome = await internalPost<IntakeResult>(
    '/contact/messages',
    {
      name,
      email,
      phone: phone || undefined,
      company: company || undefined,
      subject,
      message,
      locale,
    },
    req.headers.get('authorization'),
  );
  const result = outcome.data;
  if (!outcome.ok || !result) {
    if (outcome.status === 400) return fail('fields', 400);
    if (outcome.status === 429) return fail('rate', 429);
    return fail('unavailable', 502);
  }
  if (result.decision === 'review' || result.decision === 'discard') return received();
  if (
    result.decision !== 'accept' ||
    !isSubject(result.subject) ||
    !result.id ||
    !result.route ||
    !['company', 'inbox', 'external'].includes(result.route.mode) ||
    (result.route.mode === 'external' && !isSingleMailbox(result.route.email))
  )
    return fail('unavailable', 502);

  const consent = body.newsletter === true;
  const origin = requestOrigin(req);
  after(async () => {
    const vars: Record<string, string> = {
      ...(await companyVars(locale, origin)),
      nom_client: name,
      email_client: email,
      telephone_client: phone,
      societe_client: company,
      sujet_contact: result.subject,
      message_client: message,
      date_document: new Date().toLocaleDateString(
        locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-GB' : 'fr-FR',
      ),
    };
    // L'alerte a priorité. Un blocage par le centre est journalisé, sans perdre la demande.
    if (result.route.mode !== 'inbox')
      await sendMailCenterEvent({
        event: 'contact_alert',
        to: isSingleMailbox(result.route.email) ? result.route.email : '',
        dedupeKey: `contact-${result.id}-contact_alert`,
        vars,
      });
    await sendMailCenterEvent({
      event: 'contact_received',
      to: email,
      toName: name,
      dedupeKey: `contact-${email}-contact_received`,
      vars,
    });
    if (consent) await subscribeFromForm({ name, email, locale, source: 'contact', consent }, req);
  });
  // Aucun texte, identifiant, détail de modération, destinataire ni renseignement sur le compte en réponse.
  return received();
}
