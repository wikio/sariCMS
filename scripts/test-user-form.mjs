/** Un champ ne doit pas être démonté à chaque caractère saisi. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { load } from './test-support/load-tsx.mjs';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://admin.test/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const t = key => key;
t.has = () => true;
const field = { default: () => null };
const Form = load('components/admin/UserForm.tsx', {
  'next-intl': { useTranslations: () => t }, '@/lib/cms-admin': { cmsAdminList: async () => [] },
  '@/lib/countries': { COUNTRIES: [], findCountry: () => null }, '@/lib/wilayas': { WILAYAS: [], findWilaya: () => null },
  '@/lib/password-tools': { checkPassword: () => ({ valid: true }) },
  '@/components/admin/fields/SearchSelect': field, '@/components/admin/fields/PasswordField': field,
}).default;

test('fiche utilisateur : le champ actif garde son identité DOM et le focus pendant la saisie', async () => {
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(Form, { record: { id: '42', firstName: 'No' }, locale: 'fr', onCancel() {}, onSave() {} })));
    const field = document.getElementById('uf-firstName');
    field.focus();
    await act(async () => {
      // Le setter natif simule une frappe, sans court-circuiter le contrôle React.
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(field, 'Nou');
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(document.querySelector('button.ad-btn-primary').disabled, false, 'la modification a déclenché un rendu');
    assert.equal(document.getElementById('uf-firstName'), field); assert.equal(document.activeElement, field);
    assert.equal(field.value, 'Nou');
  } finally { await act(async () => root.unmount()); }
});
