'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Send, Upload } from 'lucide-react';
import {
  FlowStep, flowMaxScore, loadAnswers, loadProgress, saveAnswers, saveProgress,
  type FlowProgress,
} from '@/lib/recruitment-flow';

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

    const p = markDone();

    if (index === steps.length - 1) {
      const finalScore = computeScore(answers);
      commit(answers, p);
      setEnded({ message: 'Merci ! Votre candidature a bien été enregistrée.', score: finalScore });
      onComplete?.(answers, finalScore);
    } else {
      commit(answers, p);
      setIndex(index + 1);
    }
  };

  const goBack = () => {
    if (index === 0) return;
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
          {step.type === 'personal' && (step.fields || []).filter((f) => !f.hidden).map((f) => (
            <input
              key={f.key}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
              placeholder={f.label + (f.required ? ' *' : '')}
              required={f.required}
              value={answers[`${step.id}:${f.key}`] || ''}
              onChange={(e) => commit({ ...answers, [`${step.id}:${f.key}`]: e.target.value }, progress)}
            />
          ))}

          {step.type === 'experience' && (
            <input
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg"
              placeholder="Poste occupé, entreprise, durée…"
              value={answers[step.id] || ''}
              onChange={(e) => commit({ ...answers, [step.id]: e.target.value }, progress)}
            />
          )}

          {step.type === 'multiple' && (step.answers || []).map((a) => (
            <label key={a.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-800 rounded-lg cursor-pointer hover:border-sari-blue transition-colors">
              <input type="checkbox" className="w-4 h-4" checked={answers[step.id] === a.id} onChange={() => commit({ ...answers, [step.id]: a.id }, progress)} />
              <span className="text-sari-dark dark:text-white">{a.label}</span>
            </label>
          ))}

          {step.type === 'single' && (step.answers || []).map((a) => (
            <label key={a.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-800 rounded-lg cursor-pointer hover:border-sari-blue transition-colors">
              <input type="radio" name={`j-${step.id}`} className="w-4 h-4" checked={answers[step.id] === a.id} onChange={() => commit({ ...answers, [step.id]: a.id }, progress)} />
              <span className="text-sari-dark dark:text-white">{a.label}</span>
            </label>
          ))}

          {step.type === 'open' && (
            <textarea
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none resize-none rounded-lg"
              placeholder="Votre réponse…"
              maxLength={step.maxLength || undefined}
              value={answers[step.id] || ''}
              onChange={(e) => commit({ ...answers, [step.id]: e.target.value }, progress)}
            />
          )}

          {step.type === 'motivation' && (
            <textarea
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none resize-none rounded-lg"
              placeholder="Votre lettre de motivation…"
              value={answers[step.id] || ''}
              onChange={(e) => commit({ ...answers, [step.id]: e.target.value }, progress)}
            />
          )}

          {step.type === 'cv' && (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 text-center hover:border-sari-blue transition-colors rounded-lg">
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" id={`cv-${step.id}`}
                onChange={(e) => commit({ ...answers, [step.id]: e.target.files?.[0]?.name || '' }, progress)} />
              <label htmlFor={`cv-${step.id}`} className="cursor-pointer block">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{answers[step.id] || 'Déposer votre CV (PDF, DOCX)'}</p>
              </label>
            </div>
          )}

          {step.type === 'test' && (step.questions || []).map((q, qi) => (
            <div key={q.id} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2">
              <div className="font-semibold text-sari-dark dark:text-white">{qi + 1}. {q.question}</div>
              {(q.options || []).map((o) => (
                <label key={o.id} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                  <input type="radio" name={`q-${q.id}`} className="w-4 h-4" checked={answers[`${step.id}:${q.id}`] === o.id}
                    onChange={() => commit({ ...answers, [`${step.id}:${q.id}`]: o.id }, progress)} />
                  <span className="text-gray-700 dark:text-gray-300">{o.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

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
