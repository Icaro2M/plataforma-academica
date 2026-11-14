import { Repeat2 } from 'lucide-react';
import { switchProfileMode } from '@/app/actions';

/** Alterna o monitor entre "perfil de monitor" e "perfil de aluno". A permissão é conferida na Server Action. */
export function ProfileModeButton({ studentMode, returnTo, compact = false }: { studentMode: boolean; returnTo: string; compact?: boolean }) {
  const target = studentMode ? 'perfil de monitor' : 'perfil de aluno';
  return <form action={switchProfileMode}>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <button title={`Usar ${target}`} className={compact
      ? 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-accent hover:bg-[#f3f5f9]'
      : 'inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-brand hover:border-accent hover:text-accent'}>
      <Repeat2 size={15}/> Usar {target}
    </button>
  </form>;
}
