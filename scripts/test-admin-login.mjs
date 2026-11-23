import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './test-support/load-tsx.mjs';

const cms = load('lib/cms.ts');
const auth = load('lib/admin-auth.ts', { './cms': cms });
const credentials = { email: 'user@example.test', password: 'fixture' };
const session = { user: { id: '42', email: credentials.email, type: 'admin' }, accessToken: 'access', refreshToken: 'refresh' };
function login({ required = true, valid = false, upstream } = {}) {
  const calls = [];
  const { POST } = load('app/api/admin/auth/login/route.ts', {
    '@/lib/cms': { cmsFetch: async (path, options) => { calls.push([path, options.json]); return upstream ?? session; } },
    '@/lib/admin-auth': auth, '@/lib/admin-captcha': { verifyCaptcha: () => valid },
    '@/lib/admin-login-policy': { adminCaptchaRequired: async () => required },
    '@/lib/csrf': load('lib/csrf.ts'),
  });
  return { calls, submit: body => POST(new Request('https://site.test/api/admin/auth/login', { method: 'POST', body: JSON.stringify(body) })) };
}

test('CAPTCHA requis : un champ manquant ou invalide ne déclenche pas la connexion CMS', async () => {
  const form = login();
  const missing = await form.submit(credentials);
  assert.equal(missing.status, 400); assert.equal((await missing.json()).code, 'CAPTCHA_REQUIRED');
  const invalid = await form.submit({ ...credentials, captchaId: 'fixture', captchaAnswer: 'invalid' });
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).code, 'CAPTCHA_INVALID');
  assert.equal(form.calls.length, 0);
});
test('premier facteur validé : le challenge ne pose pas de cookie de session', async () => {
  const form = login({ valid: true, upstream: { requires2fa: true, challengeToken: 'challenge' } });
  const challenge = await form.submit({ ...credentials, captchaId: 'fixture', captchaAnswer: 'fixture' });
  assert.deepEqual(await challenge.json(), { requires2fa: true, challengeToken: 'challenge' });
  assert.equal(challenge.cookies.has('sari_admin_access'), false);
  assert.equal(form.calls[0][0], '/auth/login'); assert.equal('captchaAnswer' in form.calls[0][1], false);
});
test('second facteur : relayer le code au CMS sans consommer le CAPTCHA une seconde fois', async () => {
  const form = login();
  const response = await form.submit({ challengeToken: 'challenge', code: '123456' });
  assert.deepEqual(form.calls, [['/auth/2fa/challenge', { challengeToken: 'challenge', code: '123456' }]]);
  assert.equal(response.cookies.get('sari_admin_access')?.httpOnly, true);
  assert.equal(response.cookies.has('sari_csrf'), true);
});
test('la politique reste stricte si le réglage est incomplet ou si le CMS est indisponible', async () => {
  for (const [policy, expected] of [[null, true], [{}, true], [{ captchaRequired: false }, false]]) {
    const api = load('lib/admin-login-policy.ts', { './cms': { cmsFetch: async () => { if (!policy) throw Error('offline'); return policy; } } });
    assert.equal(await api.adminCaptchaRequired(), expected);
  }
});
