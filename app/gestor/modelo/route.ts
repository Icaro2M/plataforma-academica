import { rosterTemplateCsv } from '@/lib/monitors';

/** CSV modelo (UTF-8 com BOM, separador ";") para a planilha de monitores. */
export function GET() {
  return new Response(rosterTemplateCsv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-monitores.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
