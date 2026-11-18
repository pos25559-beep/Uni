// «Como está a tua semana?»: lê o texto (IA quando há consentimento, senão leitura simples),
// mostra o que o Uni percebeu para ligar/desligar e aplica como regras do plano.
import { useCallback, useEffect, useRef, useState } from 'react';
import { extractPlanIntentWithAi } from '../integrations/gemini';
import { hasAiAccess } from '../lib/aiAccess';
import { intentFromParsedBriefing, mergeIntents, type IntentItem, type PlanIntent } from '../lib/planner/intent';
import { parsePlannerBriefing } from '../lib/plannerBriefing';
import { todayStr } from '../lib/selectors';
import { useStore } from '../store/useStore';

export type PlanBriefingStatus = 'idle' | 'reading' | 'review' | 'applied';

/** Porque é que a leitura foi simples (sem IA) — para dizer ao estudante sem jargão. */
export type SimpleReadingReason = 'no_consent' | 'ai_failed' | null;

export function usePlanBriefing() {
  const [status, setStatus] = useState<PlanBriefingStatus>('idle');
  const [intent, setIntent] = useState<PlanIntent | null>(null);
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [simpleReason, setSimpleReason] = useState<SimpleReadingReason>(null);
  const [lastText, setLastText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const read = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('reading');
    setLastText(trimmed);
    setDisabledIds(new Set());

    const { courses, materials, assessments, settings } = useStore.getState();
    const today = todayStr();
    const simple = intentFromParsedBriefing(parsePlannerBriefing({ text: trimmed, courses, materials }), today);

    if (!hasAiAccess(settings)) {
      setIntent(simple);
      setSimpleReason('no_consent');
      setStatus('review');
      return;
    }
    try {
      const ai = await extractPlanIntentWithAi({ text: trimmed, courses, assessments, today, signal: controller.signal });
      if (controller.signal.aborted) return;
      setIntent(mergeIntents(simple, ai));
      setSimpleReason(null);
    } catch {
      if (controller.signal.aborted) return;
      // Sem rede, quota ou recusa da IA: a leitura simples continua a funcionar.
      setIntent(simple);
      setSimpleReason('ai_failed');
    }
    setStatus('review');
  }, []);

  const toggle = useCallback((id: string) => {
    setDisabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enabledItems: IntentItem[] = intent ? intent.items.filter((it) => !disabledIds.has(it.id)) : [];

  const apply = useCallback(() => {
    if (!intent) return false;
    const items = intent.items.filter((it) => !disabledIds.has(it.id));
    useStore.getState().applyBriefing(items, lastText);
    setStatus('applied');
    return true;
  }, [intent, disabledIds, lastText]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setIntent(null);
    setDisabledIds(new Set());
    setSimpleReason(null);
  }, []);

  return { status, intent, disabledIds, enabledItems, simpleReason, lastText, read, toggle, apply, reset };
}
