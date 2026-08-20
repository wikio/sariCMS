'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, BarChart3, BookMarked, Brain, Briefcase, Check, Circle,
  Edit, File, FileText, GripVertical, Layers, Plus, Save, Trash2,
  TrendingDown, User, X, Play,
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import { cmsAdminFetch } from '@/lib/cms-admin';
import { loadApplications } from '@/lib/recruitment';
import {
  FLOW_STEP_META, FlowStep, FlowStepType, FlowTemplate, ensureDemoFlowProgress, ensureTemplates,
  flowCompletionRate, flowFunnel, flowKey, flowMaxScore, loadFlow, loadTemplates, newStep,
  resumeUrl, saveFlow, saveTemplates,
} from '@/lib/recruitment-flow';

const STEP_ICONS: Record<FlowStepType, React.ElementType> = {
  personal: User, experience: Briefcase, motivation: FileText, cv: File,
  multiple: Check, single: Circle, open: Edit, test: Brain,
};

export default function FlowBuilderPage() {
  const params = useParams();
  const locale = useLocale();
  const id = String(params.id);
  const { showToast } = useToast();

  const [offer, setOffer] = useState<{ title?: string; status?: string } | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [editing, setEditing] = useState<FlowStep | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'funnel'>('timeline');
  const [preview, setPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const o = await cmsAdminFetch<{ title?: string; status?: string }>(`/careers/${id}?view=block`);
        setOffer(o);
      } catch { setOffer(null); }
    })();
    const stored = loadFlow(id);
    const initial = stored.length ? stored : [newStep('personal'), newStep('cv')];
    setSteps(initial);
    setTemplates(ensureTemplates());
    // Seed une progression de démo pour rendre l'entonnoir visible.
    const apps = loadApplications();
    ensureDemoFlowProgress(id, initial, apps.map((a) => a.id));
  }, [id]);

  const persist = (next: FlowStep[]) => {
    setSteps(next);
    saveFlow(id, next);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    persist(arrayMove(steps, oldIndex, newIndex));
  };

  const addStep = (type: FlowStepType, index?: number) => {
    const s = newStep(type);
    const next = [...steps];
    if (index === undefined) next.push(s); else next.splice(index + 1, 0, s);
    persist(next);
    setEditing(s);
  };

  const updateStep = (patch: Partial<FlowStep>) => {
    if (!editing) return;
    const updated = { ...editing, ...patch };
    setEditing(updated);
    persist(steps.map((s) => (s.id === updated.id ? updated : s)));
  };

  const removeStep = (stepId: string) => {
    persist(steps.filter((s) => s.id !== stepId));
    setEditing(null);
  };

  const duplicateStep = (step: FlowStep) => {
    const copy: FlowStep = { ...step, id: `${step.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: `${step.title} (copie)` };
    const next = [...steps];
    next.splice(steps.findIndex((s) => s.id === step.id) + 1, 0, copy);
    persist(next);
  };

  const saveAsTemplate = () => {
    if (!tplName.trim()) { showToast('Nommez le modèle', 'error'); return; }
    const next = [...templates, { id: `tpl-${Date.now()}`, label: tplName.trim(), category: 'Personnalisé', steps: steps.map((s) => ({ ...s })) }];
    setTemplates(next);
    saveTemplates(next);
    setTplName('');
    showToast('Modèle enregistré', 'success');
  };

  const applyTemplate = (tpl: FlowTemplate) => {
    persist(tpl.steps.map((s) => ({ ...s, id: `${s.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })));
    setTemplatesOpen(false);
    showToast(`Modèle « ${tpl.label} » appliqué`, 'success');
  };

  const categories: Array<{ name: string; types: FlowStepType[] }> = useMemo(() => {
    const pre = (Object.keys(FLOW_STEP_META) as FlowStepType[]).filter((t) => FLOW_STEP_META[t].category === 'prédéfinie');
    const dyn = (Object.keys(FLOW_STEP_META) as FlowStepType[]).filter((t) => FLOW_STEP_META[t].category === 'dynamique');
    return [{ name: 'Étapes prédéfinies', types: pre }, { name: 'Étapes dynamiques', types: dyn }];
  }, []);

  const maxScore = flowMaxScore(steps);
  const funnel = useMemo(() => flowFunnel(steps, id), [steps, id]);
  const completionRate = useMemo(() => flowCompletionRate(id, steps), [id, steps]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <Link href={`/${locale}/admin/careers`} className="text-xs font-bold uppercase tracking-widest flex items-center gap-1 mb-1" style={{ color: 'var(--ad-muted)' }}>
            <ArrowLeft className="w-3 h-3" /> Offres d’emploi
          </Link>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Layers className="w-5 h-5" style={{ color: 'var(--ad-accent)' }} /> Parcours candidat
          </h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{offer?.title || 'Offre'} · {steps.length} étape(s) · score max {maxScore}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!preview && (
            <div className="flex" style={{ border: '1px solid var(--ad-line)' }}>
              <button type="button" className={`ad-btn ad-btn-icon ${viewMode === 'timeline' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setViewMode('timeline')} title="Timeline"><Layers className="w-4 h-4" /></button>
              <button type="button" className={`ad-btn ad-btn-icon ${viewMode === 'funnel' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setViewMode('funnel')} title="Entonnoir"><BarChart3 className="w-4 h-4" /></button>
            </div>
          )}
          <button className={`ad-btn ${preview ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => { setPreview((v) => !v); setPreviewIndex(0); }}>
            {preview ? <Edit className="w-4 h-4" /> : <Play className="w-4 h-4" />} {preview ? 'Quitter l’aperçu' : 'Aperçu candidat'}
          </button>
          <button className="ad-btn ad-btn-ghost" onClick={() => setTemplatesOpen((v) => !v)}><BookMarked className="w-4 h-4" /> Modèles</button>
          <button className="ad-btn ad-btn-primary" onClick={() => { persist(steps); showToast('Parcours enregistré', 'success'); }}><Save className="w-4 h-4" /> Enregistrer</button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Bibliothèque d'étapes */}
        <aside className="ad-card p-3 ad-rise ad-rise-2 max-h-[74vh] min-w-0 overflow-y-auto ad-scroll space-y-3">
          <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Bibliothèque d’étapes</div>
          {categories.map((cat) => (
            <div key={cat.name} className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.18em] font-black" style={{ color: 'var(--ad-accent)' }}>{cat.name}</div>
              {cat.types.map((t) => {
                const Icon = STEP_ICONS[t];
                const meta = FLOW_STEP_META[t];
                return (
                  <button key={t} className="ad-card ad-card-hover w-full p-3 text-left flex items-start gap-2" onClick={() => addStep(t)}>
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ad-accent)' }} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{meta.label}</span>
                      <span className="block text-[11px] mt-0.5" style={{ color: 'var(--ad-muted)' }}>{meta.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Timeline / Entonnoir */}
        <div className="min-w-0">
          {preview ? (
            <PreviewMode steps={steps} index={previewIndex} onNav={setPreviewIndex} offerId={id} />
          ) : viewMode === 'funnel' ? (
            <FunnelView funnel={funnel} completionRate={completionRate} />
          ) : (
            <div className="ad-card p-4 ad-rise ad-rise-3">
              {steps.length === 0 && (
                <div className="text-center py-12" style={{ color: 'var(--ad-muted)' }}>
                  Aucune étape. Ajoutez-en depuis la bibliothèque.
                </div>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-0">
                    {steps.map((step, i) => (
                      <TimelineItem
                        key={step.id}
                        step={step}
                        index={i}
                        total={steps.length}
                        onEdit={() => setEditing(step)}
                        onDuplicate={() => duplicateStep(step)}
                        onRemove={() => removeStep(step.id)}
                        onAdd={() => addStep('open', i)}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
              <button className="ad-btn ad-btn-ghost w-full mt-2 border-dashed" style={{ border: '1px dashed var(--ad-line)' }} onClick={() => addStep('open')}>
                <Plus className="w-4 h-4" /> Ajouter une étape en fin de parcours
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drawer de configuration d'étape */}
      <Drawer
        open={!!editing}
        title={editing?.title || 'Étape'}
        subtitle={editing ? FLOW_STEP_META[editing.type].label : undefined}
        onClose={() => setEditing(null)}
        width={560}
        footer={editing ? (
          <>
            <button className="ad-btn ad-btn-danger mr-auto" onClick={() => removeStep(editing.id)}><Trash2 className="w-4 h-4" /> Supprimer</button>
            <button className="ad-btn ad-btn-ghost" onClick={() => setEditing(null)}>Fermer</button>
          </>
        ) : null}
      >
        {editing && <StepEditor step={editing} onChange={updateStep} />}
      </Drawer>

      {/* Drawer modèles */}
      <Drawer
        open={templatesOpen}
        title="Modèles de parcours"
        subtitle="Enregistrez le parcours actuel comme modèle réutilisable, ou appliquez un modèle existant."
        onClose={() => setTemplatesOpen(false)}
        width={560}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className="ad-input" placeholder="Nom du nouveau modèle…" value={tplName} onChange={(e) => setTplName(e.target.value)} />
            <button className="ad-btn ad-btn-primary shrink-0" onClick={saveAsTemplate}><Save className="w-4 h-4" /> Enregistrer le parcours actuel</button>
          </div>
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="ad-card p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm">{tpl.label}</div>
                  <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{tpl.category} · {tpl.steps.length} étape(s)</div>
                </div>
                <button className="ad-btn ad-btn-ghost shrink-0" onClick={() => applyTemplate(tpl)}>Appliquer</button>
              </div>
            ))}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function TimelineItem({
  step, index, total, onEdit, onDuplicate, onRemove, onAdd,
}: {
  step: FlowStep; index: number; total: number;
  onEdit: () => void; onDuplicate: () => void; onRemove: () => void; onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const Icon = STEP_ICONS[step.type];
  const meta = FLOW_STEP_META[step.type];
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <span className="w-8 h-8 flex items-center justify-center rounded-full font-black text-sm shrink-0" style={{ background: 'var(--ad-accent)', color: 'var(--ad-accent-ink)' }}>
            {index + 1}
          </span>
          {index < total - 1 && <span className="w-0.5 flex-1 my-1" style={{ background: 'var(--ad-line)' }} />}
        </div>
        <div className="flex-1 min-w-0 pb-4">
          <div className="ad-card p-3 flex items-center gap-3 group">
            <button className="cursor-grab opacity-40 hover:opacity-100" {...attributes} {...listeners} title="Glisser pour réordonner"><GripVertical className="w-4 h-4" /></button>
            <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--ad-accent)' }} />
            <button className="text-left flex-1 min-w-0" onClick={onEdit}>
              <div className="font-black text-sm truncate">{step.title}</div>
              <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                {meta.label} · {step.required ? 'Obligatoire' : 'Facultative'}{step.scoreWeight ? ` · +${step.scoreWeight} pt` : ''}
              </div>
            </button>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={onEdit}><Edit className="w-4 h-4" /></button>
              <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={onDuplicate}><Plus className="w-4 h-4" /></button>
              <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={onRemove}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function StepEditor({ step, onChange }: { step: FlowStep; onChange: (patch: Partial<FlowStep>) => void }) {
  const [showHtml, setShowHtml] = useState(false);
  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Titre de l’étape</span>
        <input className="ad-input" value={step.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">Étape obligatoire</span>
        <button type="button" className={`ad-toggle ${step.required ? 'is-on' : ''}`} onClick={() => onChange({ required: !step.required })}>
          <span className="ad-toggle-label">{step.required ? 'Oui' : 'Non'}</span><span className="ad-toggle-knob" />
        </button>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Contribution au score (0 = non noté)</span>
        <input className="ad-input" type="number" min={0} value={step.scoreWeight || 0} onChange={(e) => onChange({ scoreWeight: Number(e.target.value) || 0 })} />
      </label>

      {/* Config spécifique */}
      {step.type === 'personal' && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Champs demandés</div>
          {(step.fields || []).map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <input type="checkbox" checked={!f.hidden} onChange={() => onChange({ fields: (step.fields || []).map((x) => (x.key === f.key ? { ...x, hidden: !x.hidden } : x)) })} />
              <span className="text-sm flex-1">{f.label}</span>
              <button type="button" className={`ad-toggle ${f.required && !f.hidden ? 'is-on' : ''}`} onClick={() => onChange({ fields: (step.fields || []).map((x) => (x.key === f.key ? { ...x, required: !x.required } : x)) })}>
                <span className="ad-toggle-label">{f.required ? 'Oblig.' : 'Opt.'}</span><span className="ad-toggle-knob" />
              </button>
            </div>
          ))}
        </div>
      )}

      {step.type === 'experience' && (
        <label className="block space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Expériences minimum requises</span>
          <input className="ad-input" type="number" min={0} value={step.minExperiences || 0} onChange={(e) => onChange({ minExperiences: Number(e.target.value) || 0 })} />
        </label>
      )}

      {(step.type === 'multiple' || step.type === 'single') && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Réponses possibles {step.type === 'single' ? '(une seule réponse)' : '(cases à cocher)'}</div>
          {(step.answers || []).map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <input className="ad-input flex-1" value={a.label} onChange={(e) => onChange({ answers: (step.answers || []).map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)) })} />
              <label className="flex items-center gap-1 text-xs" title="Réponse correcte (scoring)">
                <input type="checkbox" checked={!!a.correct} onChange={() => onChange({ answers: (step.answers || []).map((x) => (x.id === a.id ? { ...x, correct: !x.correct } : x)) })} /> Correcte
              </label>
              <label className="flex items-center gap-1 text-xs" title="Réponse bloquante (interrompt la candidature)">
                <input type="checkbox" checked={!!a.blocking} onChange={() => onChange({ answers: (step.answers || []).map((x) => (x.id === a.id ? { ...x, blocking: !x.blocking } : x)) })} /> Bloquante
              </label>
              <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange({ answers: (step.answers || []).filter((x) => x.id !== a.id) })}><X className="w-4 h-4" /></button>
            </div>
          ))}
          <button className="ad-btn ad-btn-ghost" onClick={() => onChange({ answers: [...(step.answers || []), { id: `a${Date.now()}`, label: 'Nouvelle réponse' }] })}>
            <Plus className="w-4 h-4" /> Réponse
          </button>

          {/* Logique conditionnelle */}
          <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--ad-line)' }}>
            <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Logique conditionnelle (saut / fin)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                className="ad-select"
                value={step.skipRule?.value || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) { onChange({ skipRule: undefined }); return; }
                  onChange({ skipRule: { when: value, operator: 'eq', value, action: 'end', message: step.skipRule?.message || 'Candidature interrompue.' } });
                }}
              >
                <option value="">Aucune règle de saut</option>
                {(step.answers || []).map((a) => <option key={a.id} value={a.id}>Si réponse « {a.label} »</option>)}
              </select>
              {step.skipRule && (
                <select className="ad-select" value={step.skipRule.action} onChange={(e) => onChange({ skipRule: { ...step.skipRule!, action: e.target.value as 'next' | 'end' } })}>
                  <option value="end">→ Terminer la candidature</option>
                  <option value="next">→ Passer à l'étape suivante</option>
                </select>
              )}
            </div>
            {step.skipRule && (
              <input
                className="ad-input"
                placeholder="Message affiché au candidat (si fin de parcours)…"
                value={step.skipRule.message || ''}
                onChange={(e) => onChange({ skipRule: { ...step.skipRule!, message: e.target.value } })}
              />
            )}
          </div>
        </div>
      )}

      {step.type === 'open' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Longueur min</span>
            <input className="ad-input" type="number" min={0} value={step.minLength || 0} onChange={(e) => onChange({ minLength: Number(e.target.value) || 0 })} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Longueur max</span>
            <input className="ad-input" type="number" min={0} value={step.maxLength || 0} onChange={(e) => onChange({ maxLength: Number(e.target.value) || 0 })} />
          </label>
        </div>
      )}

      {step.type === 'test' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Seuil de réussite (%)</span>
              <input className="ad-input" type="number" min={0} max={100} value={step.passThreshold || 0} onChange={(e) => onChange({ passThreshold: Number(e.target.value) || 0 })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Temps par question (s)</span>
              <input className="ad-input" type="number" min={0} value={step.timeLimit || 0} onChange={(e) => onChange({ timeLimit: Number(e.target.value) || 0 })} />
            </label>
          </div>
          {(step.questions || []).map((q, qi) => (
            <div key={q.id} className="ad-card p-3 space-y-2">
              <div className="flex gap-2">
                <input className="ad-input flex-1" value={q.question} placeholder={`Question ${qi + 1}`} onChange={(e) => onChange({ questions: (step.questions || []).map((x) => (x.id === q.id ? { ...x, question: e.target.value } : x)) })} />
                <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange({ questions: (step.questions || []).filter((x) => x.id !== q.id) })}><X className="w-4 h-4" /></button>
              </div>
              {(q.options || []).map((o) => (
                <div key={o.id} className="flex items-center gap-2 pl-4">
                  <input className="ad-input flex-1" value={o.label} onChange={(e) => onChange({ questions: (step.questions || []).map((x) => (x.id === q.id ? { ...x, options: (q.options || []).map((y) => (y.id === o.id ? { ...y, label: e.target.value } : y)) } : x)) })} />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!o.correct} onChange={() => onChange({ questions: (step.questions || []).map((x) => (x.id === q.id ? { ...x, options: (q.options || []).map((y) => (y.id === o.id ? { ...y, correct: !y.correct } : y)) } : x)) })} /> Bonne</label>
                </div>
              ))}
              <button className="ad-btn ad-btn-ghost" onClick={() => onChange({ questions: (step.questions || []).map((x) => (x.id === q.id ? { ...x, options: [...(q.options || []), { id: `o${Date.now()}`, label: 'Réponse' }] } : x)) })}><Plus className="w-4 h-4" /> Réponse</button>
            </div>
          ))}
          <button className="ad-btn ad-btn-ghost" onClick={() => onChange({ questions: [...(step.questions || []), { id: `q${Date.now()}`, question: 'Nouvelle question', options: [{ id: `o${Date.now()}`, label: 'Réponse A' }], timeLimit: 30 }] })}>
            <Plus className="w-4 h-4" /> Question
          </button>
        </div>
      )}

      {/* Consigne HTML */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>Consigne (HTML riche)</span>
          <button className="text-xs underline" onClick={() => setShowHtml((v) => !v)}>{showHtml ? 'Éditeur' : 'Code HTML'}</button>
        </div>
        {showHtml ? (
          <textarea className="ad-textarea font-mono text-xs" value={step.instructions} onChange={(e) => onChange({ instructions: e.target.value })} />
        ) : (
          <textarea className="ad-textarea" value={step.instructions} placeholder="Expliquez au candidat ce qui est attendu à cette étape…" onChange={(e) => onChange({ instructions: e.target.value })} />
        )}
        {step.instructions && (
          <div className="ad-card p-3 text-sm ad-tiptap" dangerouslySetInnerHTML={{ __html: step.instructions }} />
        )}
      </div>
    </div>
  );
}

function PreviewMode({ steps, index, onNav, offerId }: { steps: FlowStep[]; index: number; onNav: (i: number) => void; offerId: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ended, setEnded] = useState<{ message: string } | null>(null);
  const step = steps[index];
  if (!steps.length) return <div className="ad-card p-12 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun parcours.</div>;
  if (!step) return null;
  const Icon = STEP_ICONS[step.type];

  const selected = answers[step.id];

  // Évalue la logique conditionnelle à la navigation « Suivant ».
  const goNext = () => {
    if (ended) return;
    const rule = step.skipRule;
    const chosen = (step.answers || []).find((a) => a.id === selected);
    // réponse bloquante
    if (chosen?.blocking) {
      setEnded({ message: 'Candidature interrompue : réponse bloquante sélectionnée.' });
      return;
    }
    if (rule) {
      const match = rule.operator === 'eq' ? selected === rule.value : selected !== rule.value;
      if (match) {
        if (rule.action === 'end') { setEnded({ message: rule.message || 'Candidature terminée.' }); return; }
        // action 'next' → on saute simplement (continue)
      }
    }
    if (index === steps.length - 1) setEnded({ message: 'Merci ! Votre candidature est enregistrée. Vous pouvez la reprendre à tout moment.' });
    else onNav(index + 1);
  };

  if (ended) {
    return (
      <div className="ad-card p-12 text-center ad-rise space-y-3">
        <Check className="w-10 h-10 mx-auto" style={{ color: 'var(--ad-ok)' }} />
        <div className="font-black text-lg">Parcours terminé</div>
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{ended.message}</p>
        <button className="ad-btn ad-btn-ghost" onClick={() => { setEnded(null); setAnswers({}); onNav(0); }}>Recommencer la simulation</button>
      </div>
    );
  }

  return (
    <div className="ad-card p-6 ad-rise space-y-4">
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ad-muted)' }}>
        <span>Étape {index + 1} / {steps.length}</span>
        <span>{Math.round(((index) / Math.max(steps.length - 1, 1)) * 100)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden" style={{ background: 'var(--ad-line)', borderRadius: 99 }}>
        <div className="h-full transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%`, background: 'var(--ad-accent)' }} />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--ad-accent) 16%, transparent)', color: 'var(--ad-accent)' }}><Icon className="w-5 h-5" /></span>
        <div>
          <div className="font-black text-lg">{step.title}</div>
          <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{step.required ? 'Obligatoire' : 'Facultative'}</div>
        </div>
      </div>
      {step.instructions && <div className="text-sm ad-tiptap" dangerouslySetInnerHTML={{ __html: step.instructions }} />}

      {/* Simulation des champs */}
      <div className="space-y-2">
        {step.type === 'personal' && (step.fields || []).filter((f) => !f.hidden).slice(0, 3).map((f) => (
          <input key={f.key} className="ad-input" placeholder={f.label} />
        ))}
        {step.type === 'multiple' && (step.answers || []).map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected === a.id} onChange={() => setAnswers((p) => ({ ...p, [step.id]: a.id }))} /> {a.label}{a.blocking && <span className="ad-chip ad-chip-warn">bloquant</span>}</label>
        ))}
        {step.type === 'single' && (step.answers || []).map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-sm"><input type="radio" name={`preview-${step.id}`} checked={selected === a.id} onChange={() => setAnswers((p) => ({ ...p, [step.id]: a.id }))} /> {a.label}{a.blocking && <span className="ad-chip ad-chip-warn">bloquant</span>}</label>
        ))}
        {step.type === 'open' && <textarea className="ad-textarea" placeholder="Votre réponse…" />}
        {step.type === 'cv' && <div className="ad-card p-4 text-center text-sm border-dashed" style={{ border: '1px dashed var(--ad-line)', color: 'var(--ad-muted)' }}>Glissez votre CV ici (PDF, DOCX)</div>}
        {step.type === 'motivation' && <textarea className="ad-textarea" placeholder="Votre lettre de motivation…" />}
        {step.type === 'test' && (step.questions || []).slice(0, 1).map((q) => (
          <div key={q.id} className="ad-card p-3 space-y-1">
            <div className="font-bold text-sm">{q.question}</div>
            {(q.options || []).map((o) => <label key={o.id} className="flex items-center gap-2 text-sm"><input type="radio" name={`qpreview-${q.id}`} /> {o.label}</label>)}
          </div>
        ))}
        {step.type === 'experience' && <input className="ad-input" placeholder="Poste occupé…" />}
      </div>

      <div className="flex justify-between pt-2">
        <button className="ad-btn ad-btn-ghost" disabled={index === 0} onClick={() => onNav(index - 1)}>Précédent</button>
        <button className="ad-btn ad-btn-primary" onClick={goNext}>{index === steps.length - 1 ? 'Terminer' : 'Suivant'}</button>
      </div>
    </div>
  );
}

function FunnelView({ funnel, completionRate }: { funnel: ReturnType<typeof flowFunnel>; completionRate: number }) {
  const maxReached = Math.max(1, ...funnel.map((f) => f.reached));
  return (
    <div className="ad-card p-5 ad-rise ad-rise-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-black flex items-center gap-2"><TrendingDown className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} /> Entonnoir de candidature</h3>
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>Taux d'abandon par étape et complétion globale du parcours.</p>
        </div>
        <div className="ad-card p-3 text-center">
          <div className="text-2xl font-black" style={{ color: 'var(--ad-accent)' }}>{completionRate}%</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>Complétion moyenne</div>
        </div>
      </div>

      {funnel.length === 0 && <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Aucune donnée de progression.</p>}
      <div className="space-y-2">
        {funnel.map((f, i) => (
          <div key={f.stepId} className="ad-card p-3">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-bold flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-black" style={{ background: 'var(--ad-surface-2)', color: 'var(--ad-muted)' }}>{i + 1}</span>
                {f.title}
              </span>
              <span className="text-xs tabular-nums" style={{ color: 'var(--ad-muted)' }}>
                {f.completed}/{f.reached} complétées · <span style={f.dropRate > 0 ? { color: 'var(--ad-danger)' } : { color: 'var(--ad-ok)' }}>{f.abandoned} abandon(s)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden" style={{ background: 'var(--ad-line)', borderRadius: 99 }}>
              <div className="h-full" style={{ width: `${(f.reached / maxReached) * 100}%`, background: 'var(--ad-accent)' }} />
            </div>
            {f.dropRate > 0 && <div className="text-[11px] mt-1" style={{ color: 'var(--ad-danger)' }}>{f.dropRate}% des candidats quittent le parcours à cette étape.</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
