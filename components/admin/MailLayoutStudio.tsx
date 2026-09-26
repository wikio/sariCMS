'use client';

/**
 * Constructeur de gabarit d'email.
 *
 * Un gabarit est l'habillage commun à tous les messages d'un module : logo,
 * titre, bouton, séparateur, image, pied de page légal et lien de
 * désinscription. Le corps du message vient se loger dans le bloc
 * « Corps du message » — un seul gabarit sert donc à tous les événements.
 *
 * Pourquoi un constructeur dédié et pas le constructeur de page (`/admin/builder`) :
 * un email n'est pas une page. Les clients de messagerie ignorent les feuilles de
 * style externes, le `flex`/`grid` et une partie du JavaScript ; ils attendent des
 * tables et des styles en ligne. Ce constructeur produit exactement cela — chaque
 * bloc est rendu par `renderMailBlock()` avec ses styles en attribut `style` —
 * alors qu'une page construite dans l'atelier graphique arriverait cassée dans
 * Outlook. Le résultat reste du HTML : l'onglet « HTML » permet de l'ajuster.
 *
 * Le gabarit est enregistré dans `data/mail/layouts.json` — jamais en base.
 */
import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Eye, Heading, Image as ImageIcon, Link2, Minus,
  Palette, Plus, Save, Trash2, Type,
} from 'lucide-react';
import {
  DEFAULT_THEME,
  renderMailHtml,
  sampleVars,
  type MailBlock,
  type MailBlockType,
  type MailLayout,
} from '@/lib/mail-center';

const BLOCK_LABELS: Record<MailBlockType, { label: string; hint: string }> = {
  logo: { label: 'Logo', hint: 'Image d’en-tête depuis la charte' },
  title: { label: 'Titre', hint: 'Une ligne d’accroche' },
  text: { label: 'Texte', hint: 'Un paragraphe court' },
  button: { label: 'Bouton', hint: 'Un lien mis en avant' },
  divider: { label: 'Séparateur', hint: 'Une ligne horizontale' },
  image: { label: 'Image', hint: 'Une illustration' },
  content: { label: 'Corps du message', hint: 'L’emplacement du texte de l’événement' },
  footer: { label: 'Pied de page', hint: 'Coordonnées, mention légale, désinscription' },
};

const BLOCK_ICONS: Record<MailBlockType, typeof Type> = {
  logo: ImageIcon,
  title: Heading,
  text: Type,
  button: Link2,
  divider: Minus,
  image: ImageIcon,
  content: Type,
  footer: Palette,
};

/** Corps fictif, pour voir le gabarit rempli pendant la construction. */
const PREVIEW_BODY =
  '<p>Bonjour {{nom_client}},</p>'
  + '<p>Votre commande <strong>{{numero_commande}}</strong> d’un montant de {{montant_ttc}} est confirmée.</p>'
  + '<p>Cordialement,<br><strong>{{nom_societe}}</strong></p>';

const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export default function MailLayoutStudio({
  layout,
  onSave,
  onCancel,
  saving,
}: {
  layout: MailLayout;
  onSave: (layout: MailLayout) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState<MailLayout>(layout);
  const [selected, setSelected] = useState<string | null>(layout.blocks[0]?.id || null);
  const [tab, setTab] = useState<'blocs' | 'charte'>('blocs');

  const theme = { ...DEFAULT_THEME, ...draft.theme };
  const active = draft.blocks.find((b) => b.id === selected) || null;
  const contentCount = draft.blocks.filter((b) => b.type === 'content').length;

  const patch = (value: Partial<MailLayout>) => setDraft((prev) => ({ ...prev, ...value }));
  const patchTheme = (value: Partial<MailLayout['theme']>) =>
    setDraft((prev) => ({ ...prev, theme: { ...DEFAULT_THEME, ...prev.theme, ...value } }));
  const patchBlock = (id: string, value: Partial<MailBlock>) =>
    setDraft((prev) => ({ ...prev, blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...value } : b)) }));

  const addBlock = (type: MailBlockType) => {
    const block: MailBlock = { id: newId(), type, align: 'left', text: '', href: '' };
    if (type === 'title') block.text = 'Votre commande est confirmée';
    if (type === 'text') block.text = 'Un message court, une idée par paragraphe.';
    if (type === 'button') { block.text = 'Voir le détail'; block.href = '{{lien_document}}'; }
    if (type === 'image') block.href = '/logo.png';
    const blocks = [...draft.blocks];
    // Le corps du message reste au centre : un bloc ajouté se place avant le pied de page.
    const footerIndex = blocks.findIndex((b) => b.type === 'footer');
    const at = footerIndex >= 0 ? footerIndex : blocks.length;
    blocks.splice(at, 0, block);
    patch({ blocks });
    setSelected(block.id);
  };

  const move = (id: string, delta: number) => {
    const index = draft.blocks.findIndex((b) => b.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= draft.blocks.length) return;
    const blocks = [...draft.blocks];
    const [row] = blocks.splice(index, 1);
    blocks.splice(target, 0, row);
    patch({ blocks });
  };

  const remove = (id: string) => {
    patch({ blocks: draft.blocks.filter((b) => b.id !== id) });
    if (selected === id) setSelected(null);
  };

  const previewHtml = useMemo(
    () => renderMailHtml({ bodyHtml: PREVIEW_BODY, layout: draft, vars: sampleVars() }),
    [draft],
  );

  const colorField = (label: string, key: keyof MailLayout['theme']) => (
    <label className="space-y-1">
      <span className="field-label">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-12 cursor-pointer rounded border"
          style={{ borderColor: 'var(--ad-line)' }}
          value={String(theme[key] || '#000000')}
          onChange={(e) => patchTheme({ [key]: e.target.value } as Partial<MailLayout['theme']>)}
        />
        <input
          className="ad-input font-mono text-xs"
          value={String(theme[key] || '')}
          onChange={(e) => patchTheme({ [key]: e.target.value } as Partial<MailLayout['theme']>)}
        />
      </span>
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="ad-input font-bold"
          style={{ maxWidth: 320 }}
          value={draft.name}
          placeholder="Nom du gabarit"
          onChange={(e) => patch({ name: e.target.value })}
        />
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'color-mix(in srgb, var(--ad-accent) 10%, transparent)' }}>
          {(['blocs', 'charte'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`ad-btn ${tab === id ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
              onClick={() => setTab(id)}
            >
              {id === 'blocs' ? 'Blocs' : 'Charte'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" className="ad-btn ad-btn-ghost" onClick={onCancel}>Annuler</button>
          <button
            type="button"
            className="ad-btn ad-btn-primary"
            disabled={saving || !draft.name.trim()}
            onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}
          >
            <Save className="h-4 w-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {contentCount === 0 && (
        <p className="ad-chip ad-chip-warn">
          Ce gabarit n’a pas de bloc « Corps du message » : le texte de l’événement ne s’affichera pas.
        </p>
      )}
      {contentCount > 1 && (
        <p className="ad-chip ad-chip-warn">
          Plusieurs blocs « Corps du message » : le texte sera répété. Gardez-en un seul.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-12">
        {/* ————— Constructeur ————— */}
        <div className="space-y-3 lg:col-span-5">
          <div className="ad-card p-3 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
              Ajouter un bloc
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(BLOCK_LABELS) as MailBlockType[]).map((type) => {
                const Icon = BLOCK_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    className="ad-btn ad-btn-ghost text-xs"
                    title={BLOCK_LABELS[type].hint}
                    onClick={() => addBlock(type)}
                  >
                    <Plus className="h-3.5 w-3.5" /> <Icon className="h-3.5 w-3.5" /> {BLOCK_LABELS[type].label}
                  </button>
                );
              })}
            </div>
          </div>

          {tab === 'blocs' && (
            <div className="ad-card overflow-hidden">
              {draft.blocks.map((block, index) => {
                const Icon = BLOCK_ICONS[block.type];
                return (
                  <div
                    key={block.id}
                    className="flex items-center gap-2 border-b px-3 py-2"
                    style={{
                      borderColor: 'var(--ad-line)',
                      background: block.id === selected ? 'color-mix(in srgb, var(--ad-accent) 10%, transparent)' : undefined,
                    }}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left text-sm font-bold"
                      onClick={() => setSelected(block.id)}
                    >
                      <Icon className="mr-2 inline h-3.5 w-3.5" />
                      {index + 1}. {BLOCK_LABELS[block.type].label}
                      {block.type === 'content' && <span className="ad-chip ad-chip-acc ml-2">texte du message</span>}
                    </button>
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => move(block.id, -1)} aria-label="Monter">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => move(block.id, 1)} aria-label="Descendre">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => remove(block.id)} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {active && (
                <div className="space-y-3 p-3" style={{ background: 'color-mix(in srgb, var(--ad-accent) 5%, transparent)' }}>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
                    {BLOCK_LABELS[active.type].label} — {BLOCK_LABELS[active.type].hint}
                  </div>

                  {['title', 'text', 'button'].includes(active.type) && (
                    <label className="block space-y-1">
                      <span className="field-label">{active.type === 'button' ? 'Libellé du bouton' : 'Texte'}</span>
                      {active.type === 'text' ? (
                        <textarea
                          className="ad-input"
                          rows={3}
                          value={active.text || ''}
                          onChange={(e) => patchBlock(active.id, { text: e.target.value })}
                        />
                      ) : (
                        <input
                          className="ad-input"
                          value={active.text || ''}
                          onChange={(e) => patchBlock(active.id, { text: e.target.value })}
                        />
                      )}
                    </label>
                  )}

                  {['button', 'image'].includes(active.type) && (
                    <label className="block space-y-1">
                      <span className="field-label">{active.type === 'button' ? 'Lien du bouton' : 'Source de l’image'}</span>
                      <input
                        className="ad-input font-mono text-xs"
                        value={active.href || ''}
                        placeholder={active.type === 'button' ? '{{lien_document}}' : '/uploads/…'}
                        onChange={(e) => patchBlock(active.id, { href: e.target.value })}
                      />
                    </label>
                  )}

                  {active.type !== 'divider' && (
                    <label className="block space-y-1">
                      <span className="field-label">Alignement</span>
                      <select
                        className="ad-select"
                        value={active.align || 'left'}
                        onChange={(e) => patchBlock(active.id, { align: e.target.value as MailBlock['align'] })}
                      >
                        <option value="left">À gauche</option>
                        <option value="center">Centré</option>
                        <option value="right">À droite</option>
                      </select>
                    </label>
                  )}

                  {active.type === 'content' && (
                    <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                      Ce bloc reçoit le texte rédigé pour chaque événement (onglet « Modules »). Il n’a pas de
                      contenu propre.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'charte' && (
            <div className="ad-card space-y-3 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {colorField('Fond de page', 'background')}
                {colorField('Fond de la carte', 'card')}
                {colorField('Couleur d’accent', 'accent')}
                {colorField('Texte', 'text')}
                {colorField('Texte secondaire', 'muted')}
              </div>

              <label className="block space-y-1">
                <span className="field-label">Arrondi des angles : {theme.radius} px</span>
                <input
                  type="range"
                  min={0}
                  max={28}
                  value={theme.radius}
                  className="w-full"
                  onChange={(e) => patchTheme({ radius: Number(e.target.value) })}
                />
              </label>

              <label className="block space-y-1">
                <span className="field-label">Logo (chemin GED ou URL)</span>
                <input className="ad-input font-mono text-xs" value={theme.logoUrl} onChange={(e) => patchTheme({ logoUrl: e.target.value })} />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="field-label">Société</span>
                  <input className="ad-input" value={theme.company} onChange={(e) => patchTheme({ company: e.target.value })} />
                </label>
                <label className="block space-y-1">
                  <span className="field-label">Téléphone</span>
                  <input className="ad-input" value={theme.phone} onChange={(e) => patchTheme({ phone: e.target.value })} />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="field-label">Adresse postale</span>
                <input className="ad-input" value={theme.address} onChange={(e) => patchTheme({ address: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="field-label">E-mail de contact</span>
                <input className="ad-input" value={theme.email} onChange={(e) => patchTheme({ email: e.target.value })} />
              </label>

              <label className="block space-y-1">
                <span className="field-label">Mention légale du pied de page</span>
                <textarea
                  className="ad-input"
                  rows={3}
                  value={theme.legalText}
                  onChange={(e) => patchTheme({ legalText: e.target.value })}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={theme.showLegal} onChange={(e) => patchTheme({ showLegal: e.target.checked })} />
                  Afficher la mention légale
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={theme.showUnsubscribe}
                    onChange={(e) => patchTheme({ showUnsubscribe: e.target.checked })}
                  />
                  Afficher un lien de désinscription
                </label>
              </div>
              {theme.showUnsubscribe && (
                <label className="block space-y-1">
                  <span className="field-label">Lien de désinscription</span>
                  <input
                    className="ad-input font-mono text-xs"
                    value={theme.unsubscribeUrl}
                    onChange={(e) => patchTheme({ unsubscribeUrl: e.target.value })}
                  />
                </label>
              )}
              <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                La désinscription est obligatoire pour toute diffusion (newsletter, campagne) ; elle reste
                facultative pour un email transactionnel attendu (commande, devis, candidature).
              </p>
            </div>
          )}
        </div>

        {/* ————— Aperçu ————— */}
        <div className="lg:col-span-7">
          <div className="ad-card overflow-hidden">
            <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--ad-line)' }}>
              <Eye className="h-4 w-4" />
              <span className="text-sm font-bold">Aperçu</span>
              <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                rendu réel, tables et styles en ligne — 600 px
              </span>
            </div>
            <iframe
              title="Aperçu du gabarit d’email"
              className="block w-full bg-white"
              style={{ height: 620, border: 0 }}
              srcDoc={previewHtml}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
