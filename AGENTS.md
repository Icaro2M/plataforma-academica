# Conecta

- Use Node.js 24; valide mudanças com `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`.
- A persistência usa libSQL assíncrono em `lib/db.ts`. Localmente, `ACADEMIA_DB_PATH` seleciona o arquivo; na nuvem, use Turso por `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`.
- O beta remoto usa Vercel Hobby + Turso Free. Nunca versione tokens, `.env.local` ou credenciais e não habilite overages.
- A configuração antiga do Render está arquivada em `docs/archive/` e não representa o deploy ativo.
- Autorização e regras de acesso ficam nas Server Actions (`app/actions.ts`); não mova decisões de permissão para componentes de cliente.
- `supabase/`, `db/schema.ts` e os artefatos Docker são opcionais/legados e não representam o deploy Vercel + Turso.
