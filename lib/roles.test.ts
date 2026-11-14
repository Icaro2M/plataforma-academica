import { describe, expect, it } from 'vitest';
import { actingRole, canAccessInstitution, institutionScope, postedRole, roleBadge } from './roles';

describe('perfis e escopo por instituição', () => {
  it('monitor em modo aluno age como aluno', () => {
    expect(actingRole({ role: 'MONITOR', student_mode: 1 })).toBe('STUDENT');
    expect(actingRole({ role: 'MONITOR', student_mode: 0 })).toBe('MONITOR');
    expect(actingRole({ role: 'PROFESSOR', student_mode: 1 })).toBe('PROFESSOR');
  });
  it('selo segue posted_as e recorre ao papel em conteúdos antigos', () => {
    expect(roleBadge(postedRole('STUDENT', 'MONITOR'), 1)).toBe('Aluno');
    expect(roleBadge(postedRole(null, 'MONITOR'), 1)).toBe('Monitor verificado');
    expect(roleBadge(postedRole('PROFESSOR', 'PROFESSOR'), 0)).toBe('Aluno');
  });
  it('restringe usuários logados à própria instituição, exceto ADMIN', () => {
    expect(institutionScope(null)).toBeUndefined();
    expect(institutionScope({ role: 'ADMIN', institution_id: null })).toBeUndefined();
    expect(institutionScope({ role: 'STUDENT', institution_id: 2 })).toBe(2);
    expect(institutionScope({ role: 'STUDENT', institution_id: null })).toBe(-1);
    expect(canAccessInstitution({ role: 'STUDENT', institution_id: 2 }, 3)).toBe(false);
    expect(canAccessInstitution({ role: 'ADMIN', institution_id: null }, 3)).toBe(true);
  });
});
