export type QuestionStatus = 'OPEN' | 'ANSWERED' | 'RESOLVED' | 'CLOSED' | 'REMOVED';
export type Question = { id: string; title: string; excerpt: string; author: string; avatar: string; subject: string; tags: string[]; answers: number; views: number; status: QuestionStatus; activity: string; time: string; solved?: boolean };
