import { Atom, BarChart3, BookOpen, BriefcaseBusiness, Code2, Database, Dna, FlaskConical, GitBranch, Globe2, Landmark, Ruler, Sigma, TrendingUp } from 'lucide-react';

const styles = {
  science: 'bg-[#edf4f3] text-[#3e7775]',
  humanities: 'bg-[#f5f1e9] text-[#876e4b]',
  technology: 'bg-[#edf1fa] text-[#4768a8]',
  mathematics: 'bg-[#f0eff8] text-[#665c99]',
  business: 'bg-[#f7f1eb] text-[#a36c42]',
  general: 'bg-[#edf1f6] text-brand',
} as const;

export function SubjectSymbol({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let Icon = BookOpen;
  let area: keyof typeof styles = 'general';
  if (key.includes('geografia')) { Icon = Globe2; area = 'humanities'; }
  else if (key.includes('biologia')) { Icon = Dna; area = 'science'; }
  else if (key.includes('historia')) { Icon = Landmark; area = 'humanities'; }
  else if (key.includes('literatura')) { Icon = BookOpen; area = 'humanities'; }
  else if (key.includes('matematica financeira')) { Icon = TrendingUp; area = 'business'; }
  else if (key.includes('matematica') || key.includes('calculo') || key.includes('algebra')) { Icon = Sigma; area = 'mathematics'; }
  else if (key.includes('fisica')) { Icon = Atom; area = 'science'; }
  else if (key.includes('quimica')) { Icon = FlaskConical; area = 'science'; }
  else if (key.includes('programacao') || key.includes('codigo')) { Icon = Code2; area = 'technology'; }
  else if (key.includes('algoritmo') || key.includes('raciocinio logico')) { Icon = GitBranch; area = 'technology'; }
  else if (key.includes('banco de dados')) { Icon = Database; area = 'technology'; }
  else if (key.includes('estatistica')) { Icon = BarChart3; area = 'mathematics'; }
  else if (key.includes('engenharia')) { Icon = Ruler; area = 'technology'; }
  else if (key.includes('administracao')) { Icon = BriefcaseBusiness; area = 'business'; }
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-lg ${styles[area]} ${size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'}`}><Icon size={size === 'lg' ? 27 : 21} strokeWidth={1.75}/></span>;
}
