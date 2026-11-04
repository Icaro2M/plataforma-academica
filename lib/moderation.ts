export type ModerationResult = { status: 'APPROVED' | 'PENDING' | 'BLOCKED'; reason: string | null };

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const profanity = /\b(porra|caralho|merda|puta|foda(?:-se)?|vai se foder|filho da puta)\b/i;
const explicit = /\b(pornografia|porno|sexo explicito|nudes?|onlyfans|masturbacao)\b/i;
const entertainment = /\b(anime|manga|filme|serie|ficcao|celebridade|futebol|jogo online|gameplay|restaurante|viagem|namoro|fofoca|receita culinaria)\b/i;
const academic = /\b(estudo|estudar|disciplina|materia|aula|prova|exercicio|trabalho|pesquisa|analise|interpretacao|conceito|teoria|calculo|equacao|algoritmo|codigo|programacao|historia|geografia|biologia|matematica|literatura|fisica|quimica|educacao|aprender|ensino|professor|monitor|escola|faculdade|universidade|banco de dados|sql|c\+\+)\b/i;
const shortAcademicReplies = /^(ok|obrigad[oa]|valeu|entendi|certo|sim|nao|não|pode ser|combinado|perfeito|bom dia|boa tarde|boa noite)[!?.\s]*$/i;

export function isStudyChatContent(value: string, subjectName: string) {
  const text = normalize(value);
  const subjectTerms = normalize(subjectName).split(/[^a-z0-9]+/).filter(term => term.length >= 4);
  return academic.test(text) || subjectTerms.some(term => text.includes(term)) || shortAcademicReplies.test(text.trim());
}

/** Triagem simples para demonstração. Conteúdo sinalizado fica invisível até revisão humana. */
export function moderateContent(value: string, kind: 'QUESTION' | 'ANSWER' | 'CHAT'): ModerationResult {
  const text = normalize(value);
  if (profanity.test(text)) return { status: 'BLOCKED', reason: 'Linguagem ofensiva detectada.' };
  if (explicit.test(text)) return { status: 'BLOCKED', reason: 'Conteúdo sexual explícito detectado.' };
  if (kind === 'QUESTION' && entertainment.test(text) && !academic.test(text)) {
    return { status: 'PENDING', reason: 'Possível assunto fora do contexto de ensino.' };
  }
  if (kind === 'CHAT' && entertainment.test(text) && !academic.test(text)) {
    return { status: 'BLOCKED', reason: 'O chat é exclusivo para dúvidas, aulas e assuntos de estudo.' };
  }
  if (kind === 'ANSWER' && entertainment.test(text) && !academic.test(text)) {
    return { status: 'PENDING', reason: 'A resposta pode estar fora do contexto da pergunta.' };
  }
  return { status: 'APPROVED', reason: null };
}
