import type { Question } from './types';

export const questions: Question[] = [
  { id: 'q1', title: 'Como interpretar o resultado de uma integral dupla?', excerpt: 'Estou travado na mudança de coordenadas e queria entender como escolher os limites...', author: 'Marina Alves', avatar: 'MA', subject: 'Cálculo II', tags: ['integrais', 'geometria'], answers: 6, views: 128, status: 'RESOLVED', activity: 'há 12 min', time: 'há 2 h', solved: true },
  { id: 'q2', title: 'Diferença entre ponteiro e referência em C++', excerpt: 'Alguém consegue explicar com um exemplo prático quando devo usar cada um?', author: 'João Victor', avatar: 'JV', subject: 'Programação', tags: ['C++', 'fundamentos'], answers: 3, views: 74, status: 'ANSWERED', activity: 'há 38 min', time: 'há 4 h' },
  { id: 'q3', title: 'Modelagem de um banco para biblioteca', excerpt: 'Minha dúvida é sobre o relacionamento entre empréstimos, exemplares e usuários.', author: 'Bianca Souza', avatar: 'BS', subject: 'Banco de Dados', tags: ['SQL', 'modelagem'], answers: 0, views: 31, status: 'OPEN', activity: 'há 1 h', time: 'há 1 h' },
  { id: 'q4', title: 'Por que a matriz de transformação não é invertível?', excerpt: 'Calculei o determinante e encontrei zero, mas não entendi o significado geométrico.', author: 'Rafael Lima', avatar: 'RL', subject: 'Álgebra Linear', tags: ['matrizes'], answers: 2, views: 56, status: 'ANSWERED', activity: 'ontem', time: 'ontem' }
];
