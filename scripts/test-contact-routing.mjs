/** Le relais Next, les événements et leurs journaux réels ; aucun SMTP, CMS ou abonnement réel. */
import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load } from './test-support/load-tsx.mjs';

const cms = load('lib/cms.ts');
const cmsOr = load('lib/server/cms-or.ts', { '@/lib/cms': cms });
const mail = load('lib/mail-center.ts');
const contractPath = 'backend/src/modules/contact/contact-contract';
const contract = load(`${contractPath}.ts`);
const internal = load('lib/server/internal-api.ts', { '../cms': cms });
const realFetch = globalThis.fetch,
  cwd = process.cwd();
const request = {
  name: 'Essai Contact',
  email: 'visitor@example.test',
  subject: 'devis',
  locale: 'ar',
  message: 'Question sur le matériel <test>.',
  captchaId: 'test-challenge',
  captchaAnswer: '12345',
};
const accepted = (route) => ({ decision: 'accept', id: 15, subject: 'technique', route });
let route, newsletter, store, tmp, tasks, outcomes, requests, smtp, signups, choice, limited, transport, savedEnv;
const fakeNext = {
  after: (job) => {
    tasks.push(job);
  },
  NextResponse: Response,
};
const envelope = (data) => Response.json({ success: true, data });
const post = (extra = {}, headers = {}) =>
  route.POST(
    new Request('https://site.example.test/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ ...request, ...extra }),
    }),
  );
const finish = async () => {
  while (tasks.length) await tasks.shift()();
};
beforeEach(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), 'contact-relay-'));
  process.chdir(tmp);
  savedEnv = Object.fromEntries(
    ['CMS_API_INTERNAL_URL', 'MAIL_INTERNAL_KEY', 'PUBLIC_SITE_ORIGIN'].map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, {
    CMS_API_INTERNAL_URL: 'https://cms.example.test/api/v1',
    MAIL_INTERNAL_KEY: 'test-only',
    PUBLIC_SITE_ORIGIN: 'https://site.example.test',
  });
  tasks = [];
  requests = [];
  smtp = [];
  signups = [];
  outcomes = [];
  limited = false;
  transport = 'smtp';
  choice = accepted({ mode: 'company', email: 'company-ar@example.test' });
  store = load('lib/mail-center-store.ts', { './mail-center': mail, path: { default: path } });
  await store.writeModules(
    Object.fromEntries(
      ['contact_alert', 'contact_received', 'newsletter_welcome'].map((e) => [
        e,
        { enabled: true, minIntervalHours: 0 },
      ]),
    ),
  );
  const send = load('lib/mail-center-send.ts', {
    './cms': cms,
    './mail-center': mail,
    './mail-center-store': store,
    './data': {
      getConfig: async (locale) => ({
        meta: { email: `display-only-${locale}@example.test`, companyName: 'Company' },
      }),
    },
  });
  const fallback = {
    subscribe: async () => {
      throw new Error('Unexpected fallback');
    },
  };
  const subs = load('lib/server/newsletter-subscribe.ts', {
    'next/server': fakeNext,
    '@/lib/cms': cms,
    '@/lib/mail-center-send': send,
    '@/lib/newsletter-store': fallback,
    './cms-or': cmsOr,
  });
  const captcha = {
    rateLimited: () => limited,
    verifyCaptcha: (id, v) => id === request.captchaId && v === request.captchaAnswer,
  };
  route = load('app/api/contact/route.ts', {
    'next/server': fakeNext,
    [`@/${contractPath}`]: contract,
    '@/lib/server/internal-api': internal,
    '@/lib/mail-center-send': send,
    '@/lib/server/cms-or': cmsOr,
    '@/lib/server/newsletter-subscribe': subs,
    '@/lib/contact-captcha': captcha,
  });
  newsletter = load('app/api/newsletter/route.ts', {
    'next/server': fakeNext,
    '@/lib/cms': cms,
    '@/lib/server/newsletter-subscribe': subs,
    '@/lib/server/cms-or': cmsOr,
    '@/lib/newsletter-captcha': captcha,
    '@/lib/newsletter-store': fallback,
  });
  globalThis.fetch = async (url, opts) => {
    const payload = JSON.parse(opts.body);
    if (url.endsWith('/contact/messages')) {
      requests.push({ headers: opts.headers, payload });
      return outcomes.shift() || envelope(choice);
    }
    if (url.endsWith('/mail/internal/send')) {
      smtp.push(payload);
      return transport === 'error'
        ? new Response(null, { status: 503 })
        : envelope({ provider: transport, messageId: 'mock-delivery' });
    }
    if (url.endsWith('/public/newsletter')) {
      signups.push(payload);
      return envelope({ created: true, subscriber: { status: 'subscribed' } });
    }
    assert.fail(`Unexpected URL: ${url}`);
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.chdir(cwd);
  rmSync(tmp, { recursive: true, force: true });
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('captcha, quota, champs et piège : aucun appel IA, abonnement ou courrier', async () => {
  assert.equal((await post({ captchaAnswer: 'wrong' })).status, 400);
  assert.equal((await post({ subject: 'unknown' })).status, 400);
  assert.equal((await post({ message: 'x'.repeat(4001) })).status, 400);
  limited = true;
  assert.equal((await post()).status, 429);
  assert.deepEqual(await (await post({ website: 'filled', newsletter: true })).json(), { ok: true });
  assert.equal(requests.length + tasks.length + smtp.length + signups.length, 0);
});
for (const decision of ['review', 'discard'])
  test(`${decision} même avec opt-in : aucune notification, copie ou inscription ; réponse neutre`, async () => {
    choice = { decision };
    const r = await post({ newsletter: true }, { cookie: 'sari_admin_access=cookie-not-a-front-session' });
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal(requests.length, 1);
    assert.ok(!requests[0].headers.Authorization);
    assert.equal(tasks.length + smtp.length + signups.length, 0);
    assert.deepEqual(await store.readSentLog(), []);
  });
test('acceptation reclassée : destination du serveur et JWT vitrine, aucune confiance dans la destination ou le compte du formulaire', async () => {
  choice = accepted({ mode: 'external', email: 'support@example.test' });
  const r = await post(
    { newsletter: true, route: { mode: 'external', email: 'other@example.test' }, userId: 99 },
    { Authorization: 'Bearer front.signed.token' },
  );
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(smtp.length, 0);
  assert.equal(requests[0].headers.Authorization, 'Bearer front.signed.token');
  assert.equal(requests[0].headers['x-mail-internal-key'], 'test-only');
  assert.ok(!('userId' in requests[0].payload) && !('route' in requests[0].payload));
  await finish();
  assert.deepEqual(
    smtp.map((m) => m.to),
    ['support@example.test', request.email, request.email],
  );
  assert.match(smtp[0].html, /technique/);
  assert.match(smtp[0].html, /&lt;test&gt;/);
  assert.ok(!smtp[0].html.includes('<test>'));
  assert.equal(signups.length, 1);
  assert.ok(signups[0].consent);
  assert.equal(signups[0].source, 'contact');
  assert.ok(
    (await store.readSentLog()).some(
      (row) => row.dedupeKey === 'contact-15-contact_alert' && row.messageId === 'mock-delivery',
    ),
  );
});
test('société localisée ; boîte interne sans alerte ni inscription implicite', async () => {
  await post();
  await finish();
  assert.deepEqual(
    smtp.map((m) => m.to),
    ['company-ar@example.test', request.email],
  );
  choice = accepted({ mode: 'inbox' });
  await post({ email: 'second@example.test', newsletter: 'true' });
  await finish();
  assert.deepEqual(
    smtp.map((m) => m.to),
    ['company-ar@example.test', request.email, 'second@example.test'],
  );
  assert.equal(signups.length, 0);
});
test('alerte désactivée, erreur SMTP et transport fichier : aucun transfert annoncé comme réussi', async () => {
  choice = accepted({ mode: 'external', email: 'dispatch@example.test' });
  await store.writeModules({ contact_alert: { enabled: false }, contact_received: { enabled: false } });
  await post();
  await finish();
  assert.equal(smtp.length, 0);
  assert.ok((await store.readSentLog()).every((r) => r.status === 'skipped'));
  await store.writeModules({ contact_alert: { enabled: true }, contact_received: { enabled: false } });
  transport = 'file';
  await post();
  await finish();
  transport = 'error';
  await post();
  await finish();
  const log = await store.readSentLog();
  assert.ok(log.some((r) => r.reason === 'file_transport' && r.status === 'skipped'));
  assert.ok(log.some((r) => r.event === 'contact_alert' && r.status === 'failed'));
  assert.ok(!log.some((r) => r.status === 'sent'));
});
test('backend indisponible, réponse inconnue, clé absente : ni faux succès ni envoi de secours', async () => {
  outcomes.push(new Response(null, { status: 503 }));
  assert.equal((await post()).status, 502);
  choice = { decision: 'unknown' };
  assert.equal((await post()).status, 502);
  delete process.env.MAIL_INTERNAL_KEY;
  assert.equal((await post()).status, 502);
  assert.equal(requests.length, 2);
  assert.equal(tasks.length + smtp.length + signups.length, 0);
});
test('déclarer la source « contact » au formulaire newsletter ne tient plus lieu de captcha', async () => {
  const req = new Request('https://site.example.test/api/newsletter', {
    method: 'POST',
    body: JSON.stringify({ action: 'subscribe', email: request.email, source: 'contact', consent: true }),
  });
  const r = await newsletter.POST(req);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).status, 'captcha-failed');
  assert.equal(signups.length, 0);
});
