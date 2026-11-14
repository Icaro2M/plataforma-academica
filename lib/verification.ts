// Funções puras de validação dos dados de verificação acadêmica.
// Não dependem de banco nem de APIs do servidor: podem ser usadas no cliente e nos testes.

export const MIN_AGE = 14;
export const MAX_AGE = 100;

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

/** Aplica a máscara 000.000.000-00 progressivamente (útil enquanto o usuário digita). */
export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Exibe apenas os dígitos centrais: ***.456.789-** */
export function maskCpf(value: string | null | undefined) {
  const digits = onlyDigits(value ?? '');
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/** Valida o CPF pelos dois dígitos verificadores. Aceita com ou sem máscara. */
export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const numbers = digits.split('').map(Number);
  const checkDigit = (length: number) => {
    const sum = numbers.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === numbers[9] && checkDigit(10) === numbers[10];
}

/** Retorna o CPF apenas com dígitos quando válido; caso contrário, null. */
export function normalizeCpf(value: string) {
  return isValidCpf(value) ? onlyDigits(value) : null;
}

function buildDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * Converte a data de nascimento para AAAA-MM-DD.
 * Aceita "AAAA-MM-DD", "DD/MM/AAAA" e objetos Date (como os lidos de planilhas .xlsx).
 */
export function parseBirthDate(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) return null;
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? '').trim();
  let date: Date | null = null;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) date = buildDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) date = buildDate(Number(match[3]), Number(match[2]), Number(match[1]));
  return date ? date.toISOString().slice(0, 10) : null;
}

export function ageOn(birthIso: string, today = new Date()) {
  const [year, month, day] = birthIso.split('-').map(Number);
  let age = today.getUTCFullYear() - year;
  const beforeBirthday = today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Data válida e idade entre 14 e 100 anos. Retorna AAAA-MM-DD ou null. */
export function validateBirthDate(value: string | Date | null | undefined, today = new Date()) {
  const iso = parseBirthDate(value);
  if (!iso) return null;
  const age = ageOn(iso, today);
  return age >= MIN_AGE && age <= MAX_AGE ? iso : null;
}

export function normalizeRegistration(value: string) {
  return value.trim().toUpperCase();
}

/** Matrícula: 3 a 30 caracteres entre A-Z, 0-9, ponto, barra e hífen. */
export function isValidRegistration(value: string) {
  return /^[A-Z0-9./-]{3,30}$/.test(normalizeRegistration(value));
}

export function normalizeFullName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

/** Nome completo: pelo menos duas palavras com letras, até 120 caracteres. */
export function isValidFullName(value: string) {
  const name = normalizeFullName(value);
  if (name.length < 5 || name.length > 120) return false;
  const words = name.split(' ').filter(word => /\p{L}/u.test(word));
  return words.length >= 2 && /^[\p{L}' .-]+$/u.test(name);
}

export type VerificationInput = {
  role: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  registration: string;
  courseId: string | number;
  subjectId?: string | number;
  notes?: string;
};

export type VerificationData = {
  role: 'MONITOR' | 'PROFESSOR';
  fullName: string;
  cpf: string;
  birthDate: string;
  registration: string;
  courseId: number;
  subjectId: number | null;
  notes: string;
};

/** Valida o formulário completo; retorna os dados normalizados ou a lista de erros. */
export function validateVerification(input: VerificationInput, today = new Date()): { ok: true; data: VerificationData } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const role = input.role === 'MONITOR' || input.role === 'PROFESSOR' ? input.role : null;
  if (!role) errors.push('Escolha o tipo de verificação: monitor ou professor.');
  if (!isValidFullName(input.fullName)) errors.push('Informe o nome completo (nome e sobrenome).');
  const cpf = normalizeCpf(input.cpf);
  if (!cpf) errors.push('CPF inválido.');
  const birthDate = validateBirthDate(input.birthDate, today);
  if (!birthDate) errors.push(`Data de nascimento inválida (idade entre ${MIN_AGE} e ${MAX_AGE} anos).`);
  if (!isValidRegistration(input.registration)) errors.push('Matrícula inválida: use de 3 a 30 letras, números, ponto, barra ou hífen.');
  const courseId = Number(input.courseId);
  if (!Number.isSafeInteger(courseId) || courseId < 1) errors.push('Selecione o curso.');
  const subjectId = Number(input.subjectId);
  const hasSubject = Number.isSafeInteger(subjectId) && subjectId > 0;
  if (role === 'MONITOR' && !hasSubject) errors.push('Selecione a cadeira da monitoria.');
  const notes = (input.notes ?? '').trim();
  if (notes.length > 500) errors.push('As observações devem ter até 500 caracteres.');
  if (errors.length || !role || !cpf || !birthDate) return { ok: false, errors };
  return {
    ok: true,
    data: { role, fullName: normalizeFullName(input.fullName), cpf, birthDate, registration: normalizeRegistration(input.registration), courseId, subjectId: role === 'MONITOR' ? subjectId : null, notes },
  };
}
