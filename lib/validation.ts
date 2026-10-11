import { z } from 'zod';

export const questionSchema = z.object({ title: z.string().trim().min(12, 'Use um título mais descritivo.').max(140), body: z.string().trim().min(30, 'Descreva um pouco mais a sua dúvida.').max(10000), subjectId: z.string().min(1), tags: z.array(z.string()).max(5) });
export const answerSchema = z.object({ body: z.string().trim().min(10).max(10000) });
export const ratingSchema = z.object({ answerId: z.string().uuid(), rating: z.number().int().min(1).max(5) });
