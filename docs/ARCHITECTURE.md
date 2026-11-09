# Arquitetura do Conecta

## Estado atual

O Conecta usa Next.js 16 com App Router, React 19 e TypeScript estrito. Server Components fazem leituras e Server Actions em `app/actions.ts` concentram mutações e autorização.

A persistência é assíncrona e centralizada em `lib/db.ts` com `@libsql/client`. Em desenvolvimento, a URL padrão aponta para um arquivo local. Em Preview/Production, `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` conectam ao banco Turso compartilhado.

## Camadas

- `app/`: rotas, telas e Server Actions.
- `components/`: componentes de apresentação e formulários.
- `lib/db.ts`: cliente libSQL, schema, seed idempotente e transações.
- `lib/store.ts`: consultas tipadas e operações de domínio.
- `lib/auth.ts`: sessões persistidas, cookie HTTP-only e hash do token.
- `lib/moderation.ts`: triagem acadêmica local sem API paga.

## Modelo de acesso

Os papéis são `STUDENT`, `MONITOR`, `PROFESSOR` e `ADMIN`. Qualquer conta autenticada pode perguntar e responder, respeitando autoria e moderação. A hierarquia instituição → curso → disciplina é validada no servidor.

## Persistência remota

Várias contas e instâncias serverless acessam o mesmo Turso. O schema usa `CREATE ... IF NOT EXISTS`, e o catálogo usa `INSERT OR IGNORE`, permitindo inicialização repetida sem apagar dados. Transações libSQL mantêm atômicas as escritas dependentes.

O seed remoto não cria usuários nem conteúdo de demonstração. O modo local preserva fixtures para testes automatizados.

## Limites atuais

O chat exige recarregamento, não há recuperação de senha, confirmação de e-mail ou rate limiting distribuído. A moderação por regras não substitui revisão humana. Esses pontos não bloqueiam o beta acadêmico controlado, mas precisam evoluir antes de uma abertura ampla.
