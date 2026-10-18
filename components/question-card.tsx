import Link from 'next/link';
import { CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import type { Question } from '@/lib/store';

export function QuestionCard({ question }: { question: Question }) {
  const created = new Date(`${question.created_at}Z`);
  return <Link href={`/perguntas/${question.id}`} className="group block border-b border-line px-4 py-4 transition-colors last:border-b-0 hover:bg-[#fafbfe] sm:px-5">
    <div className="flex items-center gap-2 text-[10px] font-medium text-muted"><span className="shrink-0 whitespace-nowrap rounded-md bg-[#eef2fb] px-2 py-1 font-semibold text-brand">{question.subject_name}</span><span className="min-w-0 truncate">{question.course_name} · {question.institution_name}</span></div>
    <h2 className="mt-2.5 font-display text-[15px] font-bold leading-[1.4] tracking-[-.025em] text-ink transition-colors group-hover:text-accent sm:text-[16px]">{question.title}</h2>
    <p className="mt-1 line-clamp-2 text-[12px] leading-[1.65] text-[#5e6c7f]">{question.body}</p>
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted"><span className="font-medium text-[#4d5d72]">{question.author_name}</span>{question.author_verified ? <span className="inline-flex items-center gap-1 text-accent"><ShieldCheck size={12}/>{question.author_role === 'MONITOR' ? 'Monitor' : question.author_role === 'PROFESSOR' ? 'Professor' : 'Verificado'}</span> : null}<span className="inline-flex items-center gap-1"><MessageCircle size={13}/>{question.answer_count} {question.answer_count === 1 ? 'resposta' : 'respostas'}</span>{question.status === 'RESOLVED' && <span className="inline-flex items-center gap-1 font-semibold text-[#267451]"><CheckCircle2 size={13}/> Resolvida</span>}<time dateTime={created.toISOString()} className="ml-auto">{created.toLocaleDateString('pt-BR')}</time></div>
  </Link>;
}
