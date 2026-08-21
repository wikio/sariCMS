'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Send, ShieldCheck, Upload } from 'lucide-react';
import ImageCaptcha from '@/components/ImageCaptcha';
import {
  FlowStep, flowMaxScore, loadAnswers, loadProgress, saveAnswers, saveProgress,
  type FlowProgress,
} from '@/lib/recruitment-flow';
import { maskPhone } from '@/lib/masks';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,}$/;

export default function CandidateJourney({
  steps,
  offerId,
  applicationId,
  onComplete,
}: {
  steps: FlowStep[];
  offerId: string;
  applicationId: number;
  onComplete?: (answers: Record<string, string>, score: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadAnswers(offerId, applicationId));
  const [progress, setProgress] = useState<FlowProgress[]>(() => loadProgress(offerId, applicationId));
  const [ended, setEnded] = useState<{ message: string; score: number } | null>(null);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reprend à la première étape non complétée (sauvegarde progressive).
  useEffect(() => {
    const done = progress.filter((p) => p.done).length;
    if (done > 0 && done < steps.length) setIndex(done);
  }, [progress, steps.length]);

  const step = steps[index];

  const maxScore = useMemo(() => flowMaxScore(steps), [steps]);

  const commit = (nextAnswers: Record<string, string>, nextProgress: FlowProgress[]) => {
    setAnswers(nextAnswers);
    saveAnswers(offerId, applicationId, nextAnswers);
    setProgress(nextProgress);
    saveProgress(offerId, applicationId, nextProgress);
  };

  const setAnswer = (key: string, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    saveAnswers(offerId, applicationId, next);
    // efface l'erreur du champ dès qu'on le corrige
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const markDone = () => {
    const nextProgress = progress.map((p) => (p.stepId === step.id ? { ...p, done: true, at: new Date().toISOString() } : p));
    if (!nextProgress.some((p) => p.stepId === step.id)) {
      nextProgress.push({ stepId: step.id, done: true, at: new Date().toISOString() });
    }
    return nextProgress;
  };

  const computeScore = (nextAnswers: Record<string, string>): number => {
    let score = 0;
    for (const s of steps) {
      if (!s.scoreWeight) continue;
      if (s.type === 'multiple' || s.type === 'single') {
        const chosen = (s.answers || []).filter((a) => nextAnswers[s.id] === a.id);
        if (chosen.some((a) => a.correct)) score += s.scoreWeight;
      }
    }
    return score;
  };

  /** Valide l'étape courante. Retourne un objet { clé: message }. */
  const validateStep = (): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!step) return out;

    if (step.type === 'personal') {
      for (const f of step.fields || []) {
        if (f.hidden) continue;
        const key = `${step.id}:${f.key}`;
        const value = (answers[key] || '').trim();
        if (f.required && !value) {
          out[key] = 'Ce champ est obligatoire.';
          continue;
        }
        if (value && f.key === 'email' && !EMAIL_RE.test(value)) {
          out[key] = 'Adresse e-mail invalide.';
        }
        if (value && (f.key === 'phone' || f.key === 'telephone') && !PHONE_RE.test(value)) {
          out[key] = 'Numéro de téléphone invalide.';
        }
      }
    }

    if (step.type === 'experience') {
      const value = (answers[step.id] || '').trim();
      if (step.required && !value) out[step.id] = 'Veuillez renseigner au moins une expérience.';
      if (step.minExperiences && step.minExperiences > 0 && !value) out[step.id] = `Minimum ${step.minExperiences} expérience(s) requise(s).`;
    }

    if (step.type === 'motivation') {
      const value = (answers[step.id] || '').trim();
      if (step.required && !value) out[step.id] = 'Votre lettre de motivation est requise.';
    }

    if (step.type === 'cv') {
      if (step.required && !answers[step.id]) out[step.id] = 'Veuillez joindre votre CV.';
    }

    if (step.type === 'open') {
      const value = (answers[step.id] || '').trim();
      if (step.required && !value) out[step.id] = 'Veuillez répondre à cette question.';
      if (value && step.minLength && value.length < step.minLength) out[step.id] = `Minimum ${step.minLength} caractères.`;
      if (value && step.maxLength && value.length > step.maxLength) out[step.id] = `Maximum ${step.maxLength} caractères.`;
    }

    if (step.type === 'multiple' || step.type === 'single') {
      if (step.required && !answers[step.id]) out[step.id] = 'Veuillez sélectionner une réponse.';
    }

    if (step.type === 'test') {
      for (const q of step.questions || []) {
        const key = `${step.id}:${q.id}`;
        if (step.required && !answers[key]) out[key] = 'Veuillez répondre à cette question.';
      }
    }

    return out;
  };

  const goNext = () => {
    if (!step) return;
    const chosen = (step.answers || []).find((a) => a.id === answers[step.id]);

    // Réponse bloquante → fin immédiate.
    if (chosen?.blocking) {
      const finalScore = computeScore(answers);
      const p = markDone();
      commit(answers, p);
      setEnded({ message: 'Votre réponse met fin à cette candidature. Merci pour votre temps.', score: finalScore });
      return;
    }

    // Logique conditionnelle.
    const rule = step.skipRule;
    if (rule) {
      const match = rule.operator === 'eq' ? answers[step.id] === rule.value : answers[step.id] !== rule.value;
      if (match && rule.action === 'end') {
        const finalScore = computeScore(answers);
        const p = markDone();
        commit(answers, p);
        setEnded({ message: rule.message || 'Candidature terminée.', score: finalScore });
        return;
      }
    }

    // Validation des champs requis / formats.
    const errs = validateStep();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Sécurité : CAPTCHA requis pour finaliser la candidature (dernière étape).
    if (index === steps.length - 1 && !captchaOk) {
      setErrors({ captcha: 'Veuillez saisir le code CAPTCHA.' });
      return;
    }

    const p = markDone();

    if (index === steps.length - 1) {
      const finalScore = computeScore(answers);
      commit(answers, p);
      setEnded({ message: 'Merci ! Votre candidature a bien été enregistrée.', score: finalScore });
      onComplete?.(answers, finalScore);
    } else {
      commit(answers, p);
      setErrors({});
      setIndex(index + 1);
    }
  };

  const goBack = () => {
    if (index === 0) return;
    setErrors({});
    setIndex(index - 1);
  };

  if (!steps.length) return null;

  if (ended) {
    return (
      <div className="bg-white dark:bg-[#1a1a1a] p-10 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center space-y-4">
        <Check className="w-14 h-14 text-green-500 mx-auto" />
        <h3 className="text-2xl font-bold text-sari-dark dark:text-white">Candidature terminée</h3>
        <p className="text-gray-600 dark:text-gray-400">{ended.message}</p>
        {maxScore > 0 && (
          <div className="inline-block bg-sari-blue/10 text-sari-blue font-bold px-4 py-2 rounded-lg">
            Score : {ended.score} / {maxScore}
          </div>
        )}
      </div>
    );
  }

  if (!step) return null;

  const progressPct = Math.round((index / steps.length) * 100);

  const inputCls = (key: string) =>
    `w-full px-4 py-3 border rounded-lg outline-none transition-colors dark:bg-[#111111] dark:text-white ${
      errors[key] ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-700 focus:border-sari-blue'
    }`;

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
        <AlertCircle className="w-3.5 h-3.5" /> {errors[key]}
      </p>
    ) : null;

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl overflow-hidden">
      {/* En-tête progression */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span className="font-semibold">Étape {index + 1} / {steps.length}</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-sari-blue transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-sari-blue text-white font-bold text-lg">{index + 1}</span>
          <div>
            <h3 className="text-xl font-bold text-sari-dark dark:text-white">{step.title}</h3>
            <div className="text-xs text-gray-500">{step.required ? 'Obligatoire' : 'Facultative'}</div>
          </div>
        </div>

        {step.instructions && (
          <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: step.instructions }} />
        )}

        {/* Champs de l'étape */}
        <div className="space-y-3">
          {step.type === 'personal' && (step.fields || []).filter((f) => !f.hidden).map((f) => {
            const key = `${step.id}:${f.key}`;
            const isEmail = f.key === 'email';
            const isPhone = f.key === 'phone' || f.key === 'telephone';
            return (
              <div key={f.key}>
                <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-1">
                  {f.label} {f.required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optionnel)</span>}
                </label>
                <input
                  type={isEmail ? 'email' : isPhone ? 'tel' : 'text'}
                  className={inputCls(key)}
                  placeholder={f.label}
                  value={answers[key] || ''}
                  onChange={(e) => setAnswer(key, isPhone ? maskPhone(e.target.value) : e.target.value)}
                />
                {fieldError(key)}
              </div>
            );
          })}

          {step.type === 'experience' && (
            <div>
              <label className="block text-sm font-semibold text-sari-dark dark:text-white mb-1">
                Expérience professionnelle {step.required && <span className="text-red-500">*</span>}
              </label>
              <input
                className={inputCls(step.id)}
                placeholder="Poste occupé, entreprise, durée…"
                value={answers[step.id] || ''}
                onChange={(e) => setAnswer(step.id, e.target.value)}
              />
              {fieldError(step.id)}
            </div>
          )}

          {step.type === 'multiple' && (
            <div className="space-y-2">
              {(step.answers || []).map((a) => (
                <label key={a.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${answers[step.id] === a.id ? 'border-sari-blue bg-sari-blue/5' : 'border-gray-200 dark:border-gray-800 hover:border-sari-blue'}`}>
                  <input type="checkbox" className="w-4 h-4" checked={answers[step.id] === a.id} onChange={() => setAnswer(step.id, a.id)} />
                  <span className="text-sari-dark dark:text-white">{a.label}</span>
                </label>
              ))}
              {fieldError(step.id)}
            </div>
          )}

          {step.type === 'single' && (
            <div className="space-y-2">
              {(step.answers || []).map((a) => (
                <label key={a.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${answers[step.id] === a.id ? 'border-sari-blue bg-sari-blue/5' : 'border-gray-200 dark:border-gray-800 hover:border-sari-blue'}`}>
                  <input type="radio" name={`j-${step.id}`} className="w-4 h-4" checked={answers[step.id] === a.id} onChange={() => setAnswer(step.id, a.id)} />
                  <span className="text-sari-dark dark:text-white">{a.label}</span>
                </label>
              ))}
              {fieldError(step.id)}
            </div>
          )}

          {step.type === 'open' && (
            <div>
              <textarea
                rows={4}
                className={inputCls(step.id)}
                placeholder="Votre réponse…"
                maxLength={step.maxLength || undefined}
                value={answers[step.id] || ''}
                onChange={(e) => setAnswer(step.id, e.target.value)}
              />
              {fieldError(step.id)}
            </div>
          )}

          {step.type === 'motivation' && (
            <div>
              <textarea
                rows={5}
                className={inputCls(step.id)}
                placeholder="Votre lettre de motivation…"
                value={answers[step.id] || ''}
                onChange={(e) => setAnswer(step.id, e.target.value)}
              />
              {fieldError(step.id)}
            </div>
          )}

          {step.type === 'cv' && (
            <div>
              <div className={`border-2 border-dashed p-6 text-center transition-colors rounded-lg ${errors[step.id] ? 'border-red-400' : 'border-gray-300 dark:border-gray-700 hover:border-sari-blue'}`}>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" id={`cv-${step.id}`}
                  onChange={(e) => setAnswer(step.id, e.target.files?.[0]?.name || '')} />
                <label htmlFor={`cv-${step.id}`} className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">{answers[step.id] || 'Déposer votre CV (PDF, DOCX)'}</p>
                </label>
              </div>
              {fieldError(step.id)}
            </div>
          )}

          {step.type === 'test' && (step.questions || []).map((q, qi) => {
            const key = `${step.id}:${q.id}`;
            return (
              <div key={q.id} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2">
                <div className="font-semibold text-sari-dark dark:text-white">{qi + 1}. {q.question} {step.required && <span className="text-red-500">*</span>}</div>
                {(q.options || []).map((o) => (
                  <label key={o.id} className={`flex items-center gap-3 p-2 cursor-pointer rounded ${answers[key] === o.id ? 'bg-sari-blue/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <input type="radio" name={`q-${q.id}`} className="w-4 h-4" checked={answers[key] === o.id}
                      onChange={() => setAnswer(key, o.id)} />
                    <span className="text-gray-700 dark:text-gray-300">{o.label}</span>
                  </label>
                ))}
                {fieldError(key)}
              </div>
            );
          })}
        </div>

        {/* CAPTCHA avant finalisation */}
        {index === steps.length - 1 && (
          <div className="bg-gray-50 dark:bg-gray-900/30 border border-sari-blue/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-sari-dark dark:text-white mb-2">
              <ShieldCheck className="w-4 h-4 text-sari-blue" /> Sécurité — CAPTCHA <span className="text-red-500">*</span>
            </div>
            <ImageCaptcha onChange={(ok) => { setCaptchaOk(ok); if (ok) setErrors((p) => { const { captcha: _c, ...rest } = p; return rest; }); }} />
            {errors.captcha && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.captcha}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
          <button type="button" onClick={goBack} disabled={index === 0}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>
          <button type="button" onClick={goNext}
            className="inline-flex items-center gap-2 bg-sari-blue text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-sari-blue/90 transition-colors">
            {index === steps.length - 1 ? (<><Send className="w-4 h-4" /> Terminer</>) : (<>Suivant <ChevronRight className="w-4 h-4" /></>)}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center">Votre progression est sauvegardée automatiquement — vous pouvez reprendre plus tard.</p>
      </div>
    </div>
  );
}
