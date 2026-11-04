import { describe, expect, it } from 'vitest';
import { isStudyChatContent, moderateContent } from './moderation';

describe('triagem acadêmica básica', () => {
  it('permite discussão educacional de filmes e anime', () => {
    expect(moderateContent('Como fazer uma análise de anime em um trabalho de literatura?', 'QUESTION').status).toBe('APPROVED');
  });
  it('envia entretenimento sem contexto acadêmico para revisão humana', () => {
    expect(moderateContent('Qual anime vocês recomendam para hoje?', 'QUESTION').status).toBe('PENDING');
  });
  it('bloqueia linguagem ofensiva e conteúdo sexual explícito', () => {
    expect(moderateContent('Esse exercício é uma merda', 'ANSWER').status).toBe('BLOCKED');
    expect(moderateContent('Envie pornografia', 'ANSWER').status).toBe('BLOCKED');
  });
  it('permite contexto legítimo de biologia', () => {
    expect(moderateContent('Como funciona a reprodução sexual em biologia?', 'QUESTION').status).toBe('APPROVED');
  });
  it('restringe chat a contexto de estudo ou confirmação curta', () => {
    expect(isStudyChatContent('Quero revisar exercícios de ponteiros antes da prova.','Programação')).toBe(true);
    expect(isStudyChatContent('Obrigado!','Programação')).toBe(true);
    expect(isStudyChatContent('Qual filme você gosta?','Programação')).toBe(false);
    expect(moderateContent('Vamos falar de anime hoje?', 'CHAT').status).toBe('BLOCKED');
  });
});
