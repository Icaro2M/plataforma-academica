# Conecta Academia

Plataforma colaborativa de apoio acadêmico entre estudantes. O primeiro corte prioriza fórum, perguntas, respostas, perfis, reputação, conversas e moderação, com uma fundação PostgreSQL/Supabase preparada para crescer.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/Storage/Realtime, PostgreSQL com RLS, Drizzle ORM e Zod. A UI usa componentes pequenos e reutilizáveis; as validações críticas ficam no servidor/domínio.

## Rodando localmente

1. `npm install`
2. copie `.env.example` para `.env.local` e preencha as chaves do projeto Supabase;
3. aplique `supabase/migrations/0001_initial.sql` no SQL Editor do Supabase;
4. `npm run dev`.

Sem credenciais, a interface continua navegável com dados demonstrativos de desenvolvimento; nenhuma informação demonstrativa é usada como persistência de produção.

## Banco e segurança

A migration inicial cria as entidades sociais principais, índices, constraints, soft delete e políticas RLS. Operações compostas como aceitar resposta, calcular reputação, conceder badges e criar conversa devem ser implementadas como funções transacionais server-side/RPC antes do uso em produção. `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta ao cliente.

## Regras de reputação

As regras previstas são centralizadas em eventos: resposta publicada (+1), resposta aceita (+10), avaliação 4 (+2) e avaliação 5 (+3). A pontuação pública pode ser reconstruída a partir de `reputation_events`, evitando incrementos arbitrários no frontend.

## Próximos passos de produção

- conectar as páginas aos Server Actions usando Supabase SSR e Drizzle;
- adicionar Storage privado com validação MIME/tamanho e URLs assinadas;
- habilitar Realtime para `messages` e `notifications`;
- completar RBAC de moderador/admin e a tela de denúncias;
- adicionar testes Vitest/Testing Library/Playwright aos fluxos críticos.
