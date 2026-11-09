# Deploy gratuito: Vercel Hobby + Turso Free

## Arquitetura ativa

O Conecta roda como aplicação Next.js na Vercel e usa um banco libSQL remoto no Turso. O sistema de arquivos da função não armazena dados da aplicação. O banco `conecta` está no plano Turso Starter, com overages desativados.

```text
Navegador → Vercel Hobby → Server Actions/Server Components → Turso Free
```

O custo é R$ 0 enquanto o projeto permanecer dentro das cotas gratuitas e nenhum recurso pago for habilitado.

## Segredos obrigatórios

Configure na Vercel, nunca no Git:

```text
TURSO_DATABASE_URL=libsql://<banco>-<organizacao>.<regiao>.turso.io
TURSO_AUTH_TOKEN=<token exclusivo da aplicação>
```

`.env*` está ignorado, com exceção de `.env.example`. Não use `DEMO_MODE` em Preview ou Production.

## Fluxo pela Vercel CLI

1. Autenticar com `npx vercel login`.
2. Executar `npx vercel` e criar/linkar o projeto, mantendo o diretório raiz atual e o preset Next.js.
3. Adicionar `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` em Preview e Production com `npx vercel env add` ou pelo painel. Cole os valores somente no prompt seguro da CLI.
4. Executar um Preview com `npx vercel`.
5. Validar cadastro, login, disciplinas, perguntas, respostas e persistência usando duas contas de teste.
6. Somente após autorização explícita, promover com `npx vercel --prod`.

## Inicialização do banco

`lib/db.ts` executa schema e catálogo idempotentes no primeiro acesso. No Turso remoto, o seed contém somente instituição, cursos e disciplinas. Contas, perguntas e respostas demonstrativas só são criadas no modo local ou quando `DEMO_MODE=1` é definido intencionalmente.

## Verificações antes de publicar

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

O smoke test HTTP remoto pode ser executado com um segredo temporário não versionado:

```powershell
$env:SMOKE_BASE_URL='https://<preview>.vercel.app'
$env:SMOKE_PASSWORD='<senha-temporaria-com-12-caracteres>'
node scripts/remote-smoke.mjs
```

## Rollback e recuperação

- Código: use o histórico de deployments da Vercel para promover novamente um deployment validado.
- Banco: rollback de código não reverte dados. Antes de mudanças destrutivas, exporte o banco com a CLI para armazenamento privado.
- Tokens: se houver suspeita de exposição, revogue o token no Turso, gere outro e atualize os ambientes da Vercel.

## Configuração anterior

O Blueprint pago do Render foi desativado e movido para `docs/archive/render.yaml.disabled`. Docker não é requisito de produção.
