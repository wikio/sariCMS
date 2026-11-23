/** Exercise translated presentation with real next-intl formatting, not just key parity. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import { useAnalyticsLabels } from '../components/admin/useAnalyticsLabels.ts';
import { DATE_FORMAT_PRESETS } from '../lib/date-format.ts';
import { MAIL_CATALOG, MAIL_VARS } from '../lib/mail-center.ts';
import { PLACEHOLDER_ICONS } from '../lib/placeholder-engine.ts';
import { ACTIONS, RESOURCES } from '../backend/sql/permissions-catalog.mjs';

const routes = {
  applications: 'applications', eventRegistrations: 'events/registrations', orders: 'orders',
  quotes: 'quotes', payments: 'payment-records', messages: 'messages', newsletter: 'newsletter',
};
const ids = (keys) => keys.map((key) => ({ key, label: 'Libellé du serveur', value: 3 }));
const snapshot = {
  applications: { byStatus: ids(['new', 'reviewed', 'interview', 'accepted', 'rejected']), byOffer: [{ label: 'Atlas' }] },
  eventRegistrations: { byStatus: ids(['confirmed', 'attended', 'pending', 'waitlist', 'rejected', 'cancelled']) },
  jobs: { byStatus: ids(['active', 'completed', 'draft']) },
  newsletter: { byStatus: ids(['subscribed', 'pending', 'unsubscribed', 'bounced', 'blocked']) },
  ged: { byKind: ids(['image', 'canvas', 'svg', 'doc', 'other']) },
  team: {
    queues: Object.entries(routes).map(([key, route]) => ({ key, href: `/admin/${route}`, label: 'Libellé du serveur', remaining: 3 })),
    byRole: ids(['admin', 'employee', 'client', 'partner', 'candidate']),
  },
};
const onError = (error) => { throw error; };
for (const locale of ['fr', 'en', 'ar']) {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
  const t = createTranslator({ locale, messages, namespace: 'admin', onError });
  test(`Dashboard and pipeline labels (${locale}) are a view of the data, not a rewrite`, () => {
    function Probe() {
      const view = useAnalyticsLabels(snapshot);
      assert.deepEqual(view.team.queues, snapshot.team.queues.map((q) => ({ ...q, label: t(`analytics.queue_${q.key}`) })));
      assert.equal(view.applications.byOffer, snapshot.applications.byOffer);
      for (const list of [view.applications.byStatus, view.eventRegistrations.byStatus, view.jobs.byStatus,
        view.newsletter.byStatus, view.ged.byKind, view.team.byRole]) {
        assert.ok(list.every(({ label, value }) => label && label !== 'Libellé du serveur' && value === 3));
      }
      return null;
    }
    renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages, onError, timeZone: 'UTC' }, createElement(Probe)));
    assert.ok(snapshot.team.queues.every((q) => q.label === 'Libellé du serveur'));
    assert.ok(t('applications.years', { count: 3.9 }).includes(new Intl.NumberFormat(locale).format(3.9)));
    for (const count of [0, 1, 2, 7]) assert.ok(t('applications.summary', { applications: count, offers: count }));
  });
  test(`Dynamic setting and permission IDs resolve (${locale}); literal tokens remain literal`, () => {
    for (const module of MAIL_CATALOG) {
      for (const { id } of [module, ...module.events]) {
        t(`mailCenter.label_${id}`); t(`mailCenter.hint_${id}`);
      }
    }
    for (const code of ['admin', 'env', 'none', 'unreadable']) t(`contactTriage.connectionSource_${code}`);
    for (const code of ['ok', 'incomplete', 'auth', 'unavailable', 'invalidResponse']) t(`contactTriage.testResult_${code}`);
    for (const { key } of MAIL_VARS) t(`mailVariables.${key}`);
    for (const { id } of PLACEHOLDER_ICONS) t(`placeholderStudio.icon_${id}`);
    for (const { labelKey } of DATE_FORMAT_PRESETS) { t(`datePicker.${labelKey}`); t(`datePicker.${labelKey}Hint`); }
    for (const action of ACTIONS) t(`permissions.action_${action}`);
    for (const resource of RESOURCES) t(t.has(`permissions.resource_${resource}`) ? `permissions.resource_${resource}` : `menu.${resource}`);
    assert.ok(t('placeholderStudio.copyImgTag', { tag: '<img>' }).includes('<img>'));
    assert.ok(t('settings.restockHint', { date: '{{date_reapprovisionnement}}', product: '{{produit}}' }).includes('{{produit}}'));
  });
}
