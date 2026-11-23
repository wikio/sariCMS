/** Contrôles de lecture seule, sans compte ni écriture, à lancer après bascule. */
import assert from 'node:assert/strict';

const target = process.argv[2];
if (!target) throw new Error('Usage : npm run prod:smoke -- https://votre-domaine [mysql|json] [--edge]');
const site = new URL(target).origin;
const get = path => fetch(site + path, { signal: AbortSignal.timeout(15000), redirect: 'manual' });
async function data(path) {
  const res = await get(path);
  assert.equal(res.status, 200, path);
  const body = await res.json();
  assert.equal(body.success, true, path);
  return body.data;
}
async function redirect(path, expected) {
  const res = await get(path);
  assert.ok([301, 302, 307, 308].includes(res.status), `${path} : ${res.status}`);
  assert.equal(new URL(res.headers.get('location'), site).href, site + expected);
  await res.arrayBuffer();
}
await redirect('/', '/fr');
for (const locale of ['fr', 'en', 'ar']) {
  const res = await get(`/${locale}`);
  assert.equal(res.status, 200); assert.match(await res.text(), new RegExp(`<html[^>]*lang="${locale}"`));
}
console.log('✓ Domaine, redirection et HTML des trois langues');
const health = await data('/api/v1/health');
assert.equal(health.status, 'ok'); assert.equal(health.env, 'production');
const driver = process.argv.slice(3).find(arg => arg !== '--edge');
if (driver) assert.equal(health.driver, driver);
assert.ok(Array.isArray((await data('/api/v1/public/products?locale=fr&limit=1')).data));
assert.ok(Array.isArray(await data('/api/v1/public/payment-methods')));
console.log(`✓ Réécriture Next → API, pilote ${health.driver}, catalogue et modes de règlement`);
await redirect('/fr/admin/dashboard', '/fr/admin');
for (const path of ['/api/admin/auth/me', '/api/admin/analytics']) {
  const res = await get(path);
  assert.equal(res.status, 401, path);
  await res.arrayBuffer();
}
console.log('✓ Visiteur sans session : page et API administratives protégées');

if (process.argv.includes('--edge')) {
  for (const path of ['/api/v1/docs', '/api/v1/orders', '/api/v1/quotes', '/fr/cart', '/fr/payment/1']) {
    const res = await get(path);
    assert.ok([403, 404].includes(res.status), `${path} : attendu 403/404, reçu ${res.status}`);
    await res.arrayBuffer();
  }
  console.log('✓ Profil Nginx public : documentation API et commerce historique non exposés');
}
