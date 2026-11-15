import type { StudyLogKind } from '../types';

export interface UniCheckInRequest {
  kind?: StudyLogKind;
  courseId?: string;
  classSlotId?: string;
  assessmentId?: string;
}

export const UNI_CHECKIN_EVENT = 'uni-open-checkin';

/** Abre globalmente o Diário / Check-in do Uni no modo e contexto indicados. */
export function openUniCheckIn(detail: UniCheckInRequest = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<UniCheckInRequest>(UNI_CHECKIN_EVENT, { detail }));
}
