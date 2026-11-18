/**
 * Moteur d'export de rapports et statistiques (CSV Excel sécurisé, JSON structuré,
 * Rapport exécutif HTML autonome, Impression / PDF, et export graphique PNG/CSV).
 */
import type { AnalyticsSnapshot } from './analytics-types';

export type ExportScope =
  | 'all'
  | 'applications'
  | 'eventRegistrations'
  | 'jobs'
  | 'content'
  | 'newsletter'
  | 'ged'
  | 'team'
  | 'commerce';

export function formatBytes(bytes: number, locale?: string): string {
  const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let idx = 0;
  let val = size;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  if (locale) {
    return new Intl.NumberFormat(locale, {
      style: 'unit', unit: ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'][idx],
      minimumFractionDigits: idx ? 1 : 0, maximumFractionDigits: idx ? 1 : 0,
    }).format(val);
  }
  return `${idx === 0 ? Math.round(val) : val.toFixed(1)} ${units[idx]}`;
}

/** Neutralise l'injection de formules Excel (`=`, `+`, `-`, `@`) et échappe les guillemets. */
export function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[;"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvLine(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(';');
}

export function buildAnalyticsCsv(snapshot: AnalyticsSnapshot, scope: ExportScope = 'all'): string {
  const lines: string[] = [];
  const want = (s: ExportScope) => scope === 'all' || scope === s;

  lines.push(csvLine(['Rapport Statistiques SARI CMS', snapshot.generatedAt]));
  lines.push(
    csvLine([
      'Filtres',
      `Période=${snapshot.filters.range}`,
      snapshot.filters.from ? `Du=${snapshot.filters.from}` : '',
      snapshot.filters.to ? `Au=${snapshot.filters.to}` : '',
      `Langue=${snapshot.filters.locale}`,
      `Granularité=${snapshot.filters.granularity}`,
    ]),
  );
  lines.push('');

  if (want('applications')) {
    const a = snapshot.applications;
    lines.push(csvLine(['=== CANDIDATURES EMPLOI ===', `Source: ${a.source}`]));
    lines.push(csvLine(['Indicateur', 'Valeur']));
    lines.push(csvLine(['Total candidatures', a.total]));
    lines.push(csvLine(['Nouvelles', a.new]));
    lines.push(csvLine(['Examinées', a.reviewed]));
    lines.push(csvLine(['Entretien', a.interview]));
    lines.push(csvLine(['Acceptées', a.accepted]));
    lines.push(csvLine(['Refusées', a.rejected]));
    lines.push(csvLine(['En cours / Restantes', a.remaining]));
    lines.push(csvLine(['Traitées', a.processed]));
    lines.push(csvLine(['Taux d’acceptation (%)', a.acceptanceRate]));
    lines.push(csvLine(['Avec CV', a.withCv]));
    if (a.byOffer.length) {
      lines.push(csvLine(['Offre', 'Candidatures']));
      for (const o of a.byOffer) lines.push(csvLine([o.label, o.value]));
    }
    lines.push('');
  }

  if (want('eventRegistrations')) {
    const e = snapshot.eventRegistrations;
    lines.push(csvLine(['=== CANDIDATURES ÉVÉNEMENTS ===', `Source: ${e.source}`]));
    lines.push(csvLine(['Indicateur', 'Valeur']));
    lines.push(csvLine(['Total participations', e.total]));
    lines.push(csvLine(['Approuvées / Confirmées', e.confirmed]));
    lines.push(csvLine(['Présents (pointés)', e.attended]));
    lines.push(csvLine(['Total approuvées + présents', e.approved]));
    lines.push(csvLine(['En attente', e.pending]));
    lines.push(csvLine(['Liste d’attente', e.waitlist]));
    lines.push(csvLine(['Refusées', e.rejected]));
    lines.push(csvLine(['Annulées', e.cancelled]));
    lines.push(csvLine(['Taux d’approbation (%)', e.approvalRate]));
    lines.push(csvLine(['Taux de présence (%)', e.attendanceRate]));
    lines.push(csvLine(['Rattachées à un client', e.linkedClients]));
    if (e.byEvent.length) {
      lines.push(csvLine(['Événement', 'Total', 'Approuvées', 'En attente', 'Présents', 'Refusées']));
      for (const row of e.byEvent) {
        lines.push(csvLine([row.title, row.total, row.approved, row.pending, row.attended, row.rejected]));
      }
    }
    lines.push('');
  }

  if (want('jobs')) {
    const j = snapshot.jobs;
    lines.push(csvLine(['=== OFFRES D’EMPLOI ===', `Source: ${j.source}`]));
    lines.push(csvLine(['Total offres', j.total]));
    lines.push(csvLine(['Actives / Ouvertes', j.active]));
    lines.push(csvLine(['Terminées / Pourvues', j.completed]));
    lines.push(csvLine(['Brouillons', j.draft]));
    for (const tp of j.byType) lines.push(csvLine([`Type: ${tp.label}`, tp.value]));
    lines.push('');
  }

  if (want('content')) {
    lines.push(csvLine(['=== CONTENU ÉDITORIAL & CATALOGUE ===']));
    lines.push(csvLine(['Articles total', snapshot.articles.total]));
    lines.push(csvLine(['Articles publiés', snapshot.articles.published]));
    lines.push(csvLine(['Articles brouillons', snapshot.articles.draft]));
    lines.push(csvLine(['Événements total', snapshot.events.total]));
    lines.push(csvLine(['Événements à venir', snapshot.events.upcoming]));
    lines.push(csvLine(['Événements terminés', snapshot.events.past]));
    lines.push(csvLine(['Auteurs total', snapshot.authors.total]));
    lines.push(csvLine(['Auteurs actifs', snapshot.authors.active]));
    lines.push(csvLine(['Produits', snapshot.catalog.products]));
    lines.push(csvLine(['Services', snapshot.catalog.services]));
    lines.push(csvLine(['Solutions', snapshot.catalog.solutions]));
    lines.push(csvLine(['Pages', snapshot.catalog.pages]));
    lines.push(csvLine(['Partenaires', snapshot.catalog.partners]));
    if (snapshot.authors.topAuthors.length) {
      lines.push(csvLine(['Auteur', 'Rôle', 'Articles']));
      for (const au of snapshot.authors.topAuthors) lines.push(csvLine([au.name, au.role, au.articles]));
    }
    lines.push('');
  }

  if (want('newsletter')) {
    const nl = snapshot.newsletter;
    lines.push(csvLine(['=== ABONNÉS NEWSLETTER ===', `Source: ${nl.source}`]));
    lines.push(csvLine(['Total', nl.total]));
    lines.push(csvLine(['Abonnés actifs', nl.subscribed]));
    lines.push(csvLine(['En attente', nl.pending]));
    lines.push(csvLine(['Désabonnés', nl.unsubscribed]));
    lines.push(csvLine(['Rebondis', nl.bounced]));
    lines.push(csvLine(['Bloqués', nl.blocked]));
    lines.push(csvLine(['Taux actifs (%)', nl.activeRate]));
    lines.push('');
  }

  if (want('ged')) {
    const g = snapshot.ged;
    lines.push(csvLine(['=== GED & FICHIERS ===']));
    lines.push(csvLine(['Total fichiers', g.totalFiles]));
    lines.push(csvLine(['Stockage total (octets)', g.totalBytes, formatBytes(g.totalBytes)]));
    lines.push(csvLine(['Fichiers utilisés', g.usedFiles]));
    lines.push(csvLine(['Fichiers non utilisés (orphelins)', g.unusedFiles]));
    lines.push(csvLine(['Taux d’utilisation (%)', g.utilizationRate]));
    lines.push(csvLine(['Références détectées', g.totalReferences]));
    lines.push(csvLine(['Planches Canvas/SVG éditables', g.editableCount]));
    lines.push(csvLine(['Fichiers versionnés', g.versionedCount]));
    if (g.byKind.length) {
      lines.push(csvLine(['Type', 'Fichiers', 'Taille']));
      for (const k of g.byKind) lines.push(csvLine([k.label, k.count, formatBytes(k.bytes)]));
    }
    if (g.byModule.length) {
      lines.push(csvLine(['Module', 'Fichiers', 'Taille']));
      for (const m of g.byModule) lines.push(csvLine([m.label, m.count, formatBytes(m.bytes)]));
    }
    lines.push('');
  }

  if (want('team')) {
    const tm = snapshot.team;
    lines.push(csvLine(['=== EMPLOYÉS, ADMINISTRATEURS & CHARGE DE TRAITEMENT ===']));
    lines.push(csvLine(['Administrateurs', tm.admins]));
    lines.push(csvLine(['Employés / Équipe', tm.employees]));
    lines.push(csvLine(['Équipe active', tm.staffActive]));
    lines.push(csvLine(['Équipe avec 2FA', tm.staffWith2FA]));
    lines.push(csvLine(['Traitements en cours', tm.workload.inProgress]));
    lines.push(csvLine(['Restant à traiter', tm.workload.remaining]));
    lines.push(csvLine(['Traités / Clôturés', tm.workload.completed]));
    lines.push(csvLine(['Taux d’avancement (%)', tm.workload.completionRate]));
    lines.push(csvLine(['File de travail', 'Total', 'En cours', 'Restant', 'Traité', 'Avancement (%)']));
    for (const q of tm.queues) {
      lines.push(csvLine([q.label, q.total, q.inProgress, q.remaining, q.completed, q.completionRate]));
    }
    if (tm.staffActivity.length) {
      lines.push(csvLine(['Membre', 'Email', 'Rôle', 'Actions période', 'Actions total', 'Dernière activité']));
      for (const s of tm.staffActivity) {
        lines.push(csvLine([s.name, s.email, s.role, s.actionsInRange, s.actionsTotal, s.lastActiveAt || '—']));
      }
    }
    lines.push('');
  }

  if (want('commerce')) {
    const c = snapshot.commerce;
    lines.push(csvLine(['=== COMMERCE & SUPPORT ===']));
    lines.push(csvLine(['Commandes total', c.ordersTotal]));
    lines.push(csvLine(['Commandes livrées', c.ordersDelivered]));
    lines.push(csvLine(['Commandes en cours', c.ordersProcessing]));
    lines.push(csvLine(['Commandes en attente', c.ordersPending]));
    lines.push(csvLine(['CA livré', c.revenueDelivered]));
    lines.push(csvLine(['Devis ouverts', c.quotesOpen]));
    lines.push(csvLine(['Devis acceptés', c.quotesAccepted]));
    lines.push(csvLine(['Messages non lus', c.messagesUnread]));
    lines.push('');
  }

  return lines.join('\r\n');
}

export function buildAnalyticsHtmlReport(snapshot: AnalyticsSnapshot, title = 'Rapport analytique SARI CMS'): string {
  const dateLabel = new Date(snapshot.generatedAt).toLocaleString('fr-FR');
  const kpis = [
    ['Candidatures emploi', snapshot.applications.total, `${snapshot.applications.accepted} acceptées · ${snapshot.applications.remaining} restantes`],
    ['Participations événements', snapshot.eventRegistrations.total, `${snapshot.eventRegistrations.approved} approuvées · ${snapshot.eventRegistrations.pending} en attente`],
    ['Offres d’emploi', snapshot.jobs.total, `${snapshot.jobs.active} actives · ${snapshot.jobs.completed} terminées`],
    ['Articles & Auteurs', snapshot.articles.total, `${snapshot.authors.total} auteurs (${snapshot.authors.active} actifs)`],
    ['Abonnés Newsletter', snapshot.newsletter.subscribed, `${snapshot.newsletter.total} total · ${snapshot.newsletter.activeRate}% actifs`],
    ['Fichiers GED', snapshot.ged.totalFiles, `${formatBytes(snapshot.ged.totalBytes)} · ${snapshot.ged.utilizationRate}% utilisés`],
    ['Équipe (Admins & Employés)', snapshot.team.staffTotal, `${snapshot.team.admins} admins · ${snapshot.team.employees} employés`],
    ['Charge restante', snapshot.team.workload.remaining, `${snapshot.team.workload.inProgress} en cours · ${snapshot.team.workload.completionRate}% traité`],
  ];

  const queueRows = snapshot.team.queues
    .map(
      (q) => `<tr>
        <td>${escapeHtml(q.label)}</td>
        <td class="num">${q.total}</td>
        <td class="num">${q.inProgress}</td>
        <td class="num"><strong>${q.remaining}</strong></td>
        <td class="num">${q.completed}</td>
        <td class="num">${q.completionRate}%</td>
      </tr>`,
    )
    .join('');

  const staffRows = snapshot.team.staffActivity
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.role)}</td>
        <td class="num">${s.actionsInRange}</td>
        <td class="num">${s.actionsTotal}</td>
        <td>${escapeHtml(s.topResources.join(', ') || '—')}</td>
      </tr>`,
    )
    .join('');

  const eventRows = snapshot.eventRegistrations.byEvent
    .map(
      (e) => `<tr>
        <td>${escapeHtml(e.title)}</td>
        <td class="num">${e.total}</td>
        <td class="num">${e.approved}</td>
        <td class="num">${e.pending}</td>
        <td class="num">${e.attended}</td>
        <td class="num">${e.rejected}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 28px; background: #fff; }
  header { border-bottom: 2px solid #169EC9; padding-bottom: 14px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  h1 { margin: 0; font-size: 22px; }
  .meta { font-size: 12px; color: #475569; margin-top: 4px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #f8fafc; }
  .kpi .v { font-size: 24px; font-weight: 800; color: #0f172a; }
  .kpi .l { font-size: 12px; font-weight: 700; color: #169EC9; margin-top: 2px; }
  .kpi .s { font-size: 11px; color: #64748b; margin-top: 4px; }
  h2 { font-size: 15px; margin: 22px 0 8px; border-left: 4px solid #169EC9; padding-left: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; color: #334155; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
  @media print { body { padding: 10px; } .no-print { display: none; } }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Généré le ${escapeHtml(dateLabel)} · Période : ${escapeHtml(snapshot.filters.range)} ${snapshot.filters.from ? `(${escapeHtml(snapshot.filters.from)} → ${escapeHtml(snapshot.filters.to)})` : ''} · Langue : ${escapeHtml(snapshot.filters.locale.toUpperCase())}</div>
    </div>
    <div class="meta">Source : ${snapshot.connected ? `Base CMS (${escapeHtml(snapshot.driver)})` : 'Magasin local'}</div>
  </header>

  <section class="kpis">
    ${kpis
      .map(
        ([l, v, s]) => `<div class="kpi"><div class="v">${escapeHtml(v)}</div><div class="l">${escapeHtml(l)}</div><div class="s">${escapeHtml(s)}</div></div>`,
      )
      .join('')}
  </section>

  <h2>File de traitement — Employés & Administrateurs</h2>
  <table>
    <thead><tr><th>Flux métier</th><th class="num">Total</th><th class="num">En cours</th><th class="num">Restant</th><th class="num">Traité</th><th class="num">Avancement</th></tr></thead>
    <tbody>${queueRows}</tbody>
  </table>

  ${
    eventRows
      ? `<h2>Participations aux événements (détail par événement)</h2>
  <table>
    <thead><tr><th>Événement</th><th class="num">Total</th><th class="num">Approuvées</th><th class="num">En attente</th><th class="num">Présents</th><th class="num">Refusées</th></tr></thead>
    <tbody>${eventRows}</tbody>
  </table>`
      : ''
  }

  <h2>Stockage & utilisation GED</h2>
  <table>
    <thead><tr><th>Type de fichier</th><th class="num">Nombre</th><th class="num">Poids</th></tr></thead>
    <tbody>
      ${snapshot.ged.byKind.map((k) => `<tr><td>${escapeHtml(k.label)}</td><td class="num">${k.count}</td><td class="num">${escapeHtml(formatBytes(k.bytes))}</td></tr>`).join('') || '<tr><td colspan="3">Aucun fichier dans la GED</td></tr>'}
    </tbody>
  </table>

  ${
    staffRows
      ? `<h2>Activité par administrateur & employé</h2>
  <table>
    <thead><tr><th>Membre</th><th>Rôle</th><th class="num">Actions (période)</th><th class="num">Total</th><th>Ressources principales</th></tr></thead>
    <tbody>${staffRows}</tbody>
  </table>`
      : ''
  }

  <footer>
    <span>SARI CMS — Rapport analytique exporté</span>
    <span>${escapeHtml(snapshot.generatedAt)}</span>
  </footer>
</body>
</html>`;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

export function downloadAnalyticsCsv(snapshot: AnalyticsSnapshot, scope: ExportScope = 'all') {
  const csv = buildAnalyticsCsv(snapshot, scope);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `sari-stats-${scope}-${fileStamp()}.csv`);
}

export function downloadAnalyticsJson(snapshot: AnalyticsSnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerDownload(blob, `sari-stats-${fileStamp()}.json`);
}

export function downloadAnalyticsHtml(snapshot: AnalyticsSnapshot, title?: string) {
  const html = buildAnalyticsHtmlReport(snapshot, title);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `sari-rapport-${fileStamp()}.html`);
}

export function printAnalyticsReport(snapshot: AnalyticsSnapshot, title?: string) {
  const html = buildAnalyticsHtmlReport(snapshot, title);
  const win = window.open('', '_blank', 'width=1024,height=780');
  if (!win) {
    downloadAnalyticsHtml(snapshot, title);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* ignore print cancellation */
    }
  }, 250);
}

export function exportChartDataCsv(title: string, items: Array<{ label: string; value: number; secondary?: number }>) {
  const lines = [csvLine(['Élément', 'Valeur', 'Secondaire'])];
  for (const it of items) {
    lines.push(csvLine([it.label, it.value, it.secondary ?? '']));
  }
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `graphique-${slug || 'stats'}-${fileStamp()}.csv`);
}

export function exportSvgNodeAsPng(svgEl: SVGSVGElement | null, title: string) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const rect = svgEl.getBoundingClientRect();
  const w = Math.max(320, Math.round(rect.width || 600));
  const h = Math.max(200, Math.round(rect.height || 300));
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          triggerDownload(pngBlob, `graphique-${slug || 'stats'}.png`);
        }
      }, 'image/png');
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
