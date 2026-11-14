import { describe, expect, it } from 'vitest';
import { ageOn, formatCpf, isValidCpf, isValidFullName, isValidRegistration, maskCpf, normalizeCpf, parseBirthDate, validateBirthDate, validateVerification } from './verification';

const today = new Date(Date.UTC(2026, 10, 14));

describe('CPF', () => {
  it('aceita CPFs com dígitos verificadores corretos, com ou sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
    expect(normalizeCpf('111.444.777-35')).toBe('11144477735');
  });
  it('recusa dígitos verificadores errados, sequências repetidas e tamanho inválido', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.444.777-53')).toBe(false);
    expect(isValidCpf('000.000.000-00')).toBe(false);
    expect(isValidCpf('999.999.999-99')).toBe(false);
    expect(isValidCpf('1234567890')).toBe(false);
    expect(normalizeCpf('123')).toBeNull();
  });
  it('aplica a máscara 000.000.000-00 enquanto digita e mascara para exibição', () => {
    expect(formatCpf('529')).toBe('529');
    expect(formatCpf('5299822')).toBe('529.982.2');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529.982.247-25999')).toBe('529.982.247-25');
    expect(maskCpf('52998224725')).toBe('***.982.247-**');
    expect(maskCpf(null)).toBe('***.***.***-**');
  });
});

describe('data de nascimento', () => {
  it('aceita AAAA-MM-DD, DD/MM/AAAA e Date', () => {
    expect(parseBirthDate('2003-03-15')).toBe('2003-03-15');
    expect(parseBirthDate('15/03/2003')).toBe('2003-03-15');
    expect(parseBirthDate('5/3/2003')).toBe('2003-03-05');
    expect(parseBirthDate(new Date(Date.UTC(2003, 2, 15)))).toBe('2003-03-15');
  });
  it('recusa datas inexistentes e formatos desconhecidos', () => {
    expect(parseBirthDate('31/02/2003')).toBeNull();
    expect(parseBirthDate('2003-13-01')).toBeNull();
    expect(parseBirthDate('03-15-2003')).toBeNull();
    expect(parseBirthDate(new Date('inválida'))).toBeNull();
    expect(parseBirthDate('')).toBeNull();
  });
  it('exige idade entre 14 e 100 anos', () => {
    expect(ageOn('2012-11-14', today)).toBe(14);
    expect(ageOn('2012-11-15', today)).toBe(13);
    expect(validateBirthDate('14/11/2012', today)).toBe('2012-11-14');
    expect(validateBirthDate('15/11/2012', today)).toBeNull();
    expect(validateBirthDate('1926-11-14', today)).toBe('1926-11-14');
    expect(validateBirthDate('1925-11-13', today)).toBeNull();
  });
});

describe('matrícula e nome completo', () => {
  it('matrícula tem 3 a 30 caracteres A-Z, 0-9, ponto, barra e hífen', () => {
    expect(isValidRegistration('2023001234')).toBe(true);
    expect(isValidRegistration('cc-2023/01.5')).toBe(true);
    expect(isValidRegistration('AB')).toBe(false);
    expect(isValidRegistration('A'.repeat(31))).toBe(false);
    expect(isValidRegistration('2023 001')).toBe(false);
    expect(isValidRegistration('MAT#1')).toBe(false);
  });
  it('nome completo tem pelo menos duas palavras', () => {
    expect(isValidFullName('Maria da Silva')).toBe(true);
    expect(isValidFullName("  João   D'Ávila ")).toBe(true);
    expect(isValidFullName('Maria')).toBe(false);
    expect(isValidFullName('Maria 123')).toBe(false);
  });
});

describe('formulário completo', () => {
  const base = { role: 'MONITOR', fullName: 'Maria da Silva', cpf: '529.982.247-25', birthDate: '2003-03-15', registration: '2023001234', courseId: '1', subjectId: '2', notes: '' };
  it('normaliza os dados válidos', () => {
    const result = validateVerification(base, today);
    expect(result).toEqual({ ok: true, data: { role: 'MONITOR', fullName: 'Maria da Silva', cpf: '52998224725', birthDate: '2003-03-15', registration: '2023001234', courseId: 1, subjectId: 2, notes: '' } });
  });
  it('exige a cadeira apenas para monitor', () => {
    expect(validateVerification({ ...base, subjectId: '' }, today).ok).toBe(false);
    const professor = validateVerification({ ...base, role: 'PROFESSOR', subjectId: '' }, today);
    expect(professor.ok && professor.data.subjectId).toBeNull();
  });
  it('lista todos os erros encontrados', () => {
    const result = validateVerification({ ...base, role: 'ADMIN', fullName: 'Maria', cpf: '111.111.111-11', birthDate: '2020-01-01', registration: 'x', courseId: '' }, today);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(6);
  });
});
