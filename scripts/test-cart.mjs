import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { act, createElement, StrictMode } from 'react';
import { JSDOM } from 'jsdom';
import { load } from './test-support/load-tsx.mjs';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://shop.test/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const prices = load('lib/catalog-price.ts');
const { CartProvider, useCart } = load('contexts/CartContext.tsx', { '@/lib/catalog-price': prices });
const item = { id: 'a', name: 'Article', price: '12,50 DA', quantity: 2, image: '' };
const saved = JSON.stringify([item]);
let root, cart;
function Probe() { cart = useCart(); return null; }
const mount = () => act(async () => root.render(createElement(StrictMode, null, createElement(CartProvider, null, createElement(Probe)))));
beforeEach(() => { localStorage.clear(); root = createRoot(document.getElementById('root')); });
afterEach(() => act(async () => root.unmount()));

test('le montage Strict Mode ne persiste jamais le panier vide du SSR', async () => {
  localStorage.setItem('sari_cart', saved);
  const proto = dom.window.Storage.prototype, write = proto.setItem, writes = [];
  proto.setItem = function (...args) { writes.push(args); return write.apply(this, args); };
  try { await mount(); } finally { proto.setItem = write; }
  assert.deepEqual(writes, []); assert.deepEqual(cart.items, [item]); assert.equal(cart.total, 25);
});

test('le retour du paiement restaure pending si nécessaire ; confirmer vide les deux copies durablement', async () => {
  localStorage.setItem('sari_pending_cart', saved); localStorage.setItem('sari_cart', 'json incomplet');
  await mount(); assert.deepEqual(cart.items, [item]);
  await act(async () => cart.clearCart());
  assert.deepEqual(cart.items, []); assert.equal(localStorage.getItem('sari_pending_cart'), null);
  await act(async () => root.unmount()); root = createRoot(document.getElementById('root')); await mount();
  assert.deepEqual(cart.items, []); assert.equal(localStorage.getItem('sari_cart'), '[]');
});

test('le panier courant, même vide, prime sur une copie antérieure ; les quantités persistent', async () => {
  localStorage.setItem('sari_cart', '[]'); localStorage.setItem('sari_pending_cart', saved);
  await mount(); assert.equal(cart.items.length, 0);
  await act(async () => cart.addToCart(item)); await act(async () => cart.updateQuantity(item.id, 3));
  assert.equal(JSON.parse(localStorage.getItem('sari_cart'))[0].quantity, 3);
});

test('écran de paiement : choisir ou quitter ne vide rien ; seul « confirmer » enregistre et vide', async () => {
  const calls = [], router = { push() {} };
  const Page = load('app/[locale]/payment/[id]/page.tsx', {
    'next/navigation': { useParams: () => ({ id: '17' }), useRouter: () => router },
    'next-intl': { useLocale: () => 'fr', useTranslations: () => key => key },
    '@/contexts/AuthContext': { useAuth: () => ({ isAuthenticated: true, user: { name: 'Test', email: 'test@example.org' } }) },
    '@/contexts/OrdersContext': { useOrders: () => ({ orders: [{ id: 17, items: [], grandTotal: 25 }], updateOrder: (...args) => calls.push(['order', ...args]) }) },
    '@/contexts/CartContext': { useCart }, '@/components/ui/Breadcrumb': { default: () => null },
    '@/lib/use-currency': { useCurrency: () => ({ format: String, withSymbol: String }) },
    '@/lib/cms': { cmsFetch: async () => [{ id: 'cod', type: 'cod', active: true, name: 'Livraison' }] },
    '@/lib/shop-store': {}, '@/lib/masks': {},
    '@/lib/payments': { addPaymentRecord: () => calls.push(['record']), isAutoValidated: () => false },
  }).default;
  localStorage.setItem('sari_cart', saved); localStorage.setItem('sari_pending_cart', saved);
  const show = page => act(async () => root.render(createElement(CartProvider, null, page ? createElement(Page) : createElement(Probe))));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  await show(true); await act(async () => button('Livraison').click()); await show(false);
  assert.deepEqual(calls, []); assert.deepEqual(cart.items, [item]);
  await show(true); await act(async () => button('Livraison').click()); await act(async () => button('confirmPayment').click());
  assert.deepEqual(calls, [['record'], ['order', 17, { payment: 'cod', status: 'pending_payment' }]]);
  assert.equal(localStorage.getItem('sari_cart'), '[]'); assert.equal(localStorage.getItem('sari_pending_cart'), null);
});

test('prix du catalogue : mêmes milliers et centimes pour les formats FR, EN et AR', () => {
  for (const [input, amount] of [['2 450 € HT', 2450], ['€2,450 excl. VAT', 2450], ['2 450,50 €', 2450.5], ['12,50 D.A.', 12.5],
    ['$2,450.50', 2450.5], ['٢٬٤٥٠٫٥٠', 2450.5], [12.345, 12.345], ['Sur devis', 0]]) {
    assert.equal(prices.catalogPrice(input), amount, String(input));
  }
});
