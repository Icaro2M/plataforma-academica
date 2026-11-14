// Regras puras sobre papéis e perfis em uso.
export type RoleName = 'STUDENT' | 'MONITOR' | 'PROFESSOR' | 'ADMIN';

/** Papel em uso: um monitor em "perfil de aluno" age como aluno. */
export function actingRole(user: { role: RoleName; student_mode?: number | null }): RoleName {
  return user.role === 'MONITOR' && Number(user.student_mode) === 1 ? 'STUDENT' : user.role;
}

/** Papel exibido em uma pergunta ou resposta: usa posted_as e recorre ao papel atual em conteúdos antigos. */
export function postedRole(postedAs: string | null | undefined, authorRole: RoleName): RoleName {
  return (postedAs === 'STUDENT' || postedAs === 'MONITOR' || postedAs === 'PROFESSOR' || postedAs === 'ADMIN') ? postedAs : authorRole;
}

export function roleBadge(role: RoleName, verified: number | boolean) {
  if (role === 'ADMIN') return 'Coordenação';
  if (verified && role === 'MONITOR') return 'Monitor verificado';
  if (verified && role === 'PROFESSOR') return 'Professor verificado';
  return 'Aluno';
}

/** Admin vê todas as instituições; os demais só a própria. */
export function canAccessInstitution(user: { role: RoleName; institution_id: number | null } | null, institutionId: number) {
  if (!user || user.role === 'ADMIN') return true;
  return user.institution_id === institutionId;
}

/** Instituição usada para filtrar listagens: undefined = sem restrição. -1 = conta sem instituição (não vê nada). */
export function institutionScope(user: { role: RoleName; institution_id: number | null } | null) {
  if (!user || user.role === 'ADMIN') return undefined;
  return user.institution_id ?? -1;
}
