import { describe, expect, it } from 'vitest';
import { classifyLiveClose, liveCloseMessageKey } from '../geminiLiveVoice';

describe('classifyLiveClose', () => {
  it('reconhece falta de cota', () => {
    expect(classifyLiveClose({ code: 1011, reason: 'RESOURCE_EXHAUSTED: quota exceeded' })).toBe('quota');
    expect(classifyLiveClose({ reason: 'HTTP 429' })).toBe('quota');
  });
  it('reconhece chave recusada', () => {
    expect(classifyLiveClose({ code: 1008, reason: 'API key not valid' })).toBe('key');
    expect(classifyLiveClose({ reason: 'Permission denied' })).toBe('key');
  });
  it('usa mensagem genérica para o resto e para eventos vazios', () => {
    expect(classifyLiveClose({ code: 1000, reason: 'deadline expired' })).toBe('generic');
    expect(classifyLiveClose(undefined)).toBe('generic');
    expect(liveCloseMessageKey('generic')).toBe('assistant:liveVoice.sessionEnded');
  });
});
