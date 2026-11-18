import { describe, expect, it } from 'vitest';
import {
  deriveLegacyAvailability,
  legacyScheduleFromSettings,
  migrateAvailabilitySettings,
  reconcileAvailabilityChanges,
  resolvePlannerPrefs,
  weeklyStudyMinutes,
} from '../planner/availability';
import { applyWeekdayPreset } from '../plannerBriefing';
import { migrateStoreState } from '../storeMigration';
import type { Settings } from '../../types';

const base: Settings = {
  userName: 'Teste',
  theme: 'light',
  semesterName: 'S1',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-31',
  dailyStudyMinutes: 120,
  studyDays: [1, 2, 3, 4, 5],
  geminiApiKey: '',
  geminiModel: 'gemini-4-hydrogen',
  googleClientId: '',
};

// Uma só fonte de disponibilidade: o horário por dia; dias e minutos antigos são derivados.
describe('disponibilidade de estudo', () => {
  it('sem horário, reproduz as definições antigas (mesmos minutos, sem extra ao fim de semana)', () => {
    const s = legacyScheduleFromSettings(base);
    expect(s['1']).toMatchObject({ enabled: true, minutes: 120 });
    expect(s['6']).toMatchObject({ enabled: false, minutes: 120 });
    expect(weeklyStudyMinutes(s)).toBe(600);
    expect(resolvePlannerPrefs(base).weekdaySchedule?.['0']?.enabled).toBe(false);
  });

  it('deriva dias e média de minutos a partir do horário', () => {
    const schedule = applyWeekdayPreset('evenings_week'); // úteis 120, sábado 210, domingo off
    expect(deriveLegacyAvailability(schedule)).toEqual({
      studyDays: [1, 2, 3, 4, 5, 6],
      dailyStudyMinutes: Math.round((120 * 5 + 210) / 6),
    });
  });

  it('desligar um dia nas Definições desliga-o no horário', () => {
    const prev = { ...base, studyDays: [1, 2, 3, 4, 5, 6], plannerPrefs: { ...resolvePlannerPrefs(base), weekdaySchedule: applyWeekdayPreset('evenings_week') } };
    const out = reconcileAvailabilityChanges(prev, { studyDays: [1, 2, 3, 4, 5] });
    expect(out.plannerPrefs?.weekdaySchedule?.['6']?.enabled).toBe(false);
    expect(out.studyDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('mudar os minutos nas Definições aplica-se a todos os dias ligados', () => {
    const prev = { ...base, plannerPrefs: { ...resolvePlannerPrefs(base), weekdaySchedule: applyWeekdayPreset('evenings_week') } };
    const out = reconcileAvailabilityChanges(prev, { dailyStudyMinutes: 90 });
    expect(out.plannerPrefs?.weekdaySchedule?.['1']?.minutes).toBe(90);
    expect(out.plannerPrefs?.weekdaySchedule?.['6']?.minutes).toBe(90);
    expect(out.dailyStudyMinutes).toBe(90);
  });

  it('um horário novo atualiza os valores antigos', () => {
    const schedule = applyWeekdayPreset('light_week_strong_weekend');
    const out = reconcileAvailabilityChanges(base, { plannerPrefs: { ...resolvePlannerPrefs(base), weekdaySchedule: schedule } });
    expect(out.studyDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('mudanças sem disponibilidade passam intactas', () => {
    expect(reconcileAvailabilityChanges(base, { userName: 'X' })).toEqual({ userName: 'X' });
  });

  it('a migração v10 guarda o antigo veto de studyDays dentro do horário', () => {
    const v9 = {
      ...base,
      studyDays: [1, 2, 3, 4, 5],
      plannerPrefs: { ...resolvePlannerPrefs(base), weekdaySchedule: applyWeekdayPreset('light_week_strong_weekend') },
    };
    const migrated = migrateAvailabilitySettings(v9);
    expect(migrated.plannerPrefs?.weekdaySchedule?.['6']?.enabled).toBe(false);
    expect(migrated.plannerPrefs?.weekdaySchedule?.['0']?.enabled).toBe(false);
    expect(migrated.studyDays).toEqual([1, 2, 3, 4, 5]);

    const state = migrateStoreState({ settings: v9, courses: [], materials: [] }, 9) as unknown as { settings: Settings };
    expect(state.settings.plannerPrefs?.weekdaySchedule?.['6']?.enabled).toBe(false);
  });
});
