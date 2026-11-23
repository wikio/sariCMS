/** Écrans réels, traductions réelles et session CMS simulée : jamais d’écriture sur un compte du site. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, test } from 'node:test';
import { act, createElement, useEffect } from 'react';
import { createTranslator } from 'next-intl';
import { JSDOM } from 'jsdom';
import { load } from './test-support/load-tsx.mjs';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.test/fr/contact?subject=client' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  FormData: dom.window.FormData,
  IS_REACT_ACT_ENVIRONMENT: true,
  confirm: () => true,
});
const { createRoot } = await import('react-dom/client');
const contact = load('backend/src/modules/contact/contact-contract.ts');
const labels = load('lib/contact-subjects.ts');
const messages = JSON.parse(readFileSync(new URL('../messages/fr.json', import.meta.url), 'utf8'));
const intl = {
  useLocale: () => 'fr',
  useTranslations: (namespace) =>
    createTranslator({
      locale: 'fr',
      messages,
      namespace,
      onError: (e) => {
        throw e;
      },
    }),
};
const host = document.getElementById('root');
let root, handler, toasts;
const libs = {
  'next/link': { default: ({ href, children }) => createElement('a', { href }, children) },
  'next-intl': intl,
  '@/backend/src/modules/contact/contact-contract': contact,
  '@/lib/contact-subjects': labels,
  '@/lib/cms-admin': { cmsAdminFetch: (...args) => handler(...args) },
  './Toast': { useToast: () => ({ showToast: (...args) => toasts.push(args) }) },
  '@/components/shared/DateText': { default: ({ value }) => value },
};
const Connection = load('components/admin/ContactAiConnection.tsx', libs).default;
const emptyAi = {
  configured: false,
  source: 'none',
  model: '',
  overrides: { url: '', model: '', hasKey: false },
};
const Settings = load('components/admin/ContactTriageSettings.tsx', {
  ...libs,
  './ContactAiConnection': { default: Connection },
}).default;
const Inbox = load('components/admin/ContactInbox.tsx', libs).default;
const Score = load('components/admin/ContactScore.tsx', libs).default;
const mount = (C, props = {}) => act(async () => root.render(createElement(C, props)));
const change = (el, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
    el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
const click = (el) => act(async () => el.click());
const button = (text, parent = host) =>
  [...parent.querySelectorAll('button')].find((b) => b.textContent === text);
const realFetch = globalThis.fetch;
beforeEach(() => {
  root = createRoot(host);
  toasts = [];
  handler = () => assert.fail('unexpected call');
});
afterEach(async () => {
  await act(async () => root.unmount());
  globalThis.fetch = realFetch;
});

test('règles : six destinations ; adresse externe modifiable et persistée après réouverture', async () => {
  let policy = {
    minConfidence: 90,
    spam: 'review',
    inappropriate: 'review',
    mismatch: 'review',
    penaltyPoints: 0,
    routes: Object.fromEntries(contact.SUBJECTS.map((s) => [s, { mode: 'company' }])),
  };
  handler = async (path, opts) => {
    assert.equal(path, '/contact/triage/policy');
    if (opts) {
      assert.equal(opts.method, 'PUT');
      policy = opts.json;
    }
    return { policy: structuredClone(policy), ai: emptyAi };
  };
  await mount(Settings);
  assert.equal(host.querySelectorAll('select[id^="route-"]').length, 6);
  assert.match(host.textContent, /Aucune API IA configurée/);
  await change(host.querySelector('#route-rh'), 'external');
  await change(host.querySelector('input[type="email"]'), 'rh@example.test');
  await click(button('Enregistrer'));
  assert.deepEqual(policy.routes.rh, { mode: 'external', email: 'rh@example.test' });
  assert.equal(toasts[0][1], 'success');
  await mount(Settings, { key: 'fresh' });
  assert.equal(host.querySelector('input[type="email"]').value, 'rh@example.test');
});
test('connexion LLM : teste le brouillon puis l’enregistre séparément ; champ secret vide à la relecture ; retour au .env', async () => {
  const env = { ...emptyAi, source: 'env', configured: true, model: 'modele-env' };
  const fields = {
    url: 'https://modele.example.test/v1/chat/completions',
    model: 'modele-de-test',
    apiKey: 'cle-fictive-de-test',
  };
  let baseline = env,
    result = 'auth';
  const calls = [];
  handler = async (path, opts) => {
    calls.push({ path, ...opts });
    if (path.endsWith('/test')) return { code: result };
    assert.equal(path, '/contact/triage/connection');
    if (opts.method === 'DELETE') baseline = env;
    else {
      assert.equal(opts.method, 'PUT');
      baseline = {
        source: 'admin',
        configured: true,
        model: fields.model,
        overrides: { url: fields.url, model: fields.model, hasKey: true },
      };
    }
    return structuredClone(baseline);
  };
  const input = (name) => host.querySelector('#contact-ai-' + name);
  await mount(Connection, { initial: env });
  assert.match(host.textContent, /Configuration du serveur/);
  assert.equal(input('key').type, 'password');
  assert.equal(input('key').value, '');
  await change(input('url'), fields.url);
  await change(input('model'), fields.model);
  await change(input('key'), fields.apiKey);
  await click(button('Tester la connexion'));
  assert.deepEqual(calls, [{ path: '/contact/triage/connection/test', method: 'POST', json: fields }]);
  assert.match(host.textContent, /Authentification refusée/);
  assert.deepEqual(baseline, env);
  result = 'ok';
  await click(button('Tester la connexion'));
  assert.match(host.textContent, /Connexion réussie/);
  await click(button('Enregistrer la connexion'));
  assert.deepEqual(calls[2], { path: '/contact/triage/connection', method: 'PUT', json: fields });
  assert.equal(input('key').value, '');
  assert.equal(input('key').placeholder, 'Clé enregistrée, non affichée');
  assert.ok(!host.innerHTML.includes(fields.apiKey));
  await mount(Connection, { initial: baseline, key: 'reload' });
  assert.equal(input('url').value, fields.url);
  assert.equal(input('model').value, fields.model);
  assert.equal(input('key').value, '');
  await click(button('Tester la connexion'));
  assert.deepEqual(calls[3].json, { url: fields.url, model: fields.model }); // aucune clé stockée renvoyée par le navigateur
  window.confirm = () => false;
  await click(button('Revenir au .env'));
  assert.equal(calls.length, 4);
  window.confirm = () => true;
  await click(button('Revenir au .env'));
  assert.deepEqual(calls[4], { path: '/contact/triage/connection', method: 'DELETE' });
  assert.match(host.textContent, /Configuration du serveur/);
  assert.equal(input('url').value, '');
  assert.equal(input('key').value, '');
  assert.equal(button('Revenir au .env'), undefined);
});
test('boîte Contact : lire une quarantaine, la reclasser, prendre en charge, conserver la note ; filtre appliqué au serveur', async () => {
  let row = {
    id: 7,
    name: 'Test',
    email: 'office@example.test',
    subject: 'devis',
    message: 'Suivi de ma demande de service.',
    status: 'review',
    createdAt: '2026-01-02',
    meta: { selectedSubject: 'devis', reason: 'mismatch', suggestedSubject: 'technique' },
  };
  let filter;
  handler = async (path, opts) => {
    if (opts) {
      assert.equal(opts.method, 'PATCH');
      assert.equal(path, '/contact/messages/7');
      row = {
        ...row,
        status: opts.json.status,
        subject: opts.json.subject,
        meta: { ...row.meta, followUp: opts.json.followUp },
      };
      return row;
    }
    filter = JSON.parse(new URL(path, 'https://fixture.test').searchParams.get('filter') || '{}');
    return {
      data: !filter.status || filter.status === row.status ? [row] : [],
      meta: { total: 1, totalPages: 1 },
    };
  };
  await mount(Inbox);
  const details = host.querySelector('details');
  details.open = true;
  assert.match(details.textContent, /Sujet non correspondant/);
  const [subject, status] = details.querySelectorAll('select');
  await change(subject, 'technique');
  await change(status, 'read');
  await change(details.querySelector('textarea'), 'Appeler mercredi');
  await click(button('Enregistrer', details));
  assert.equal(row.subject, 'technique');
  assert.equal(row.status, 'read');
  assert.equal(row.meta.followUp, 'Appeler mercredi');
  await change(host.querySelector('header select'), 'review');
  assert.deepEqual(filter, { status: 'review' });
  assert.equal(host.querySelector('details'), null);
});
test('dossier : consultation par id de compte et annulation explicite d’un retrait', async () => {
  let reversed = false;
  handler = async (path, opts) => {
    if (opts) {
      assert.equal(opts.method, 'DELETE');
      assert.equal(path, '/contact/triage/accounts/42/penalties/3');
      reversed = true;
      return { ok: true };
    }
    assert.equal(path, '/contact/triage/accounts/42');
    return reversed
      ? { score: 0, total: 0, notes: [] }
      : {
          score: -4,
          total: 1,
          notes: [{ id: 3, points: -4, reason: 'inappropriate', createdAt: '2026-01-01' }],
        };
  };
  await mount(Score, { account: '42' });
  assert.match(host.textContent, /-4 points/);
  assert.match(host.textContent, /Propos inappropriés/);
  await click(button('Annuler le retrait'));
  assert.ok(reversed);
  assert.match(host.textContent, /0 points/);
});
test('vitrine connectée : un seul POST pour le formulaire et son opt-in, jeton en en-tête seulement', async () => {
  const propsOnly = { default: ({ children }) => children };
  const Page = load('app/[locale]/contact/page.tsx', {
    ...libs,
    'next/link': propsOnly,
    '@/contexts/AuthContext': { frontToken: () => 'front.test.jwt' },
    '@/lib/data': {
      getConfig: async () => ({
        meta: { social: {}, phone: '02111', email: 'contact@example.test', address: 'Test' },
      }),
      getMenu: async () => ({ socialLinks: {} }),
    },
    '@/components/shared/SocialLinks': { default: () => null },
    '@/components/shared/PageVisibilityGuard': propsOnly,
    '@/lib/masks': { maskPhone: (v) => v },
    '@/components/ServerCaptcha': {
      default: ({ onChange, onCaptchaData }) => {
        useEffect(() => {
          onChange(true);
          onCaptchaData({ id: 'test', value: 'ABCDE' });
        }, [onChange, onCaptchaData]);
        return null;
      },
    },
  }).default;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return Response.json({ ok: true });
  };
  await mount(Page);
  assert.match(host.textContent, /Le texte peut être analysé/);
  await change(host.querySelector('input[placeholder="Jean Dupont"]'), 'Test Client');
  await change(host.querySelector('input[type=email]'), 'test@example.test');
  await change(host.querySelector('textarea'), 'Question sur mon compte client');
  await click(host.querySelector('#newsletter'));
  await click(host.querySelector('#acceptTerms'));
  await click(host.querySelector('button[type=submit]'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/contact');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer front.test.jwt');
  const payload = JSON.parse(calls[0].opts.body);
  assert.equal(payload.subject, 'client');
  assert.equal(payload.newsletter, true);
  assert.ok(!('userId' in payload));
  assert.match(host.textContent, /Formulaire transmis/);
});
