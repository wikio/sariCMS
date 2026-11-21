/** La vraie vitrine (AuthProvider + cmsFetch) avec stockage de navigateur isolé et HTTP simulé. */
import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { createRequire } from 'node:module';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { load } from './test-support/load-tsx.mjs';

const require = createRequire(import.meta.url);
const { AuthProvider, useAuth, FRONT_TOKEN_KEY } = load('contexts/AuthContext.tsx', { '@/lib/cms': load('lib/cms.ts') });
const dom = new JSDOM('<div id="root"></div>', { url: 'https://storefront.test/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = require('react-dom/client');
const rootElement = document.getElementById('root');
const account = { id: 17, firstName: 'Nour', lastName: 'Test', type: 'partner', email: 'nour@example.test', locale: 'ar' };
const details = { type: 'client', name: 'Test Client', email: 'client@example.test', password: 'fixturePassword123' };
const ok = (data) => Response.json({ success: true, data });
let auth, root, requests;
function Probe() {
  auth = useAuth();
  return auth.isLoading ? 'loading' : auth.isAuthenticated ? auth.user.name : 'guest';
}
const mount = () => act(async () => root.render(createElement(AuthProvider, null, createElement(Probe))));
async function call(fn) { let value; await act(async () => { value = await fn(); }); return value; }
function storageEvent(key) { window.dispatchEvent(new window.StorageEvent('storage', { key })); }
beforeEach(() => {
  localStorage.clear(); root = createRoot(rootElement); requests = [];
  globalThis.fetch = async (url) => { requests.push(url); return new Response(null, { status: 401 }); };
});
afterEach(async () => { await act(async () => root.unmount()); });

test('première visite et ancien profil sans jeton : invité, sans appel privé', async () => {
  await mount();
  assert.equal(rootElement.textContent, 'guest');
  await act(async () => root.unmount()); root = createRoot(rootElement);
  localStorage.setItem('sari_user', JSON.stringify(account));
  localStorage.setItem('sari_users_registry', JSON.stringify([details]));
  localStorage.setItem('sari_cart', '[42]');
  await mount();
  assert.equal(rootElement.textContent, 'guest'); assert.deepEqual(requests, []);
  assert.equal(localStorage.getItem('sari_user'), null); assert.equal(localStorage.getItem('sari_users_registry'), null);
  assert.equal(localStorage.getItem('sari_cart'), '[42]');
  assert.equal(await call(() => auth.login(details.email, details.password)), null);
  assert.equal(rootElement.textContent, 'guest'); assert.equal(localStorage.getItem(FRONT_TOKEN_KEY), null);
});

test('jeton refusé : aucune identité mise en cache ne survit au rechargement', async () => {
  localStorage.setItem(FRONT_TOKEN_KEY, 'expired'); localStorage.setItem('sari_user', JSON.stringify(account));
  await mount();
  assert.deepEqual(requests, ['/api/v1/auth/me']); assert.equal(rootElement.textContent, 'guest');
  assert.equal(localStorage.getItem(FRONT_TOKEN_KEY), null);
});

test('session valide : aucun nom avant validation ; seul le compte du serveur apparaît', async () => {
  localStorage.setItem(FRONT_TOKEN_KEY, 'active'); localStorage.setItem('sari_user', '{"name":"Ancien profil"}');
  let reply;
  globalThis.fetch = (url, init) => {
    assert.equal(url, '/api/v1/auth/me'); assert.equal(init.headers.Authorization, 'Bearer active');
    return new Promise((resolve) => { reply = resolve; });
  };
  await mount(); assert.equal(rootElement.textContent, 'loading'); assert.equal(auth.user, null);
  await act(async () => reply(ok(account)));
  assert.equal(rootElement.textContent, 'Nour Test'); assert.equal(auth.user.type, 'partner'); assert.equal(auth.user.locale, 'ar');
  await call(() => auth.logout()); assert.equal(rootElement.textContent, 'guest');
  assert.equal(localStorage.getItem(FRONT_TOKEN_KEY), null);
});

test('inscription et connexion : ni une panne, ni une création, ni un défi 2FA ne valent session', async () => {
  await mount();
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await call(() => auth.register(details)), false);
  assert.equal(await call(() => auth.login(details.email, details.password)), null);
  globalThis.fetch = async () => new Response(null, { status: 400 });
  assert.equal(await call(() => auth.register(details)), false);
  globalThis.fetch = async () => Response.json({ ok: true, result: { id: 17 } });
  assert.equal(await call(() => auth.register(details)), true);
  globalThis.fetch = async () => ok({ requires2fa: true, challengeToken: 'challenge' });
  assert.equal(await call(() => auth.login(details.email, details.password)), null);
  assert.equal(rootElement.textContent, 'guest'); assert.equal(localStorage.length, 0);
  globalThis.fetch = async (url) => ok(url.endsWith('/auth/login') ? { accessToken: 'authenticated' } : account);
  assert.equal((await call(() => auth.login(account.email, details.password))).id, '17');
  assert.equal(rootElement.textContent, 'Nour Test'); assert.equal(localStorage.length, 1);
  assert.equal(localStorage.getItem(FRONT_TOKEN_KEY), 'authenticated');
});

test('entre onglets : un profil seul et une ancienne réponse /me ne rouvrent pas une session', async () => {
  await mount();
  await act(async () => { localStorage.setItem('sari_user', JSON.stringify(account)); storageEvent('sari_user'); });
  assert.equal(rootElement.textContent, 'guest');
  let reply;
  globalThis.fetch = () => new Promise((resolve) => { reply = resolve; });
  await act(async () => { localStorage.setItem(FRONT_TOKEN_KEY, 'from-other-tab'); storageEvent(FRONT_TOKEN_KEY); });
  assert.equal(rootElement.textContent, 'loading');
  await act(async () => { localStorage.clear(); storageEvent(null); });
  await act(async () => reply(ok(account)));
  assert.equal(rootElement.textContent, 'guest'); assert.equal(localStorage.length, 0);
});
