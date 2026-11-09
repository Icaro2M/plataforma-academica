# Conecta Academia

Fórum acadêmico para estudantes, monitores e professores. A aplicação usa libSQL local no desenvolvimento e Turso no beta remoto, sem API paga. É um projeto acadêmico independente, sem vínculo oficial com a Universidade de Fortaleza.

## Executar no VS Code

Requer **Node.js 24** e npm. No terminal da pasta do projeto:

```powershell
npm ci
npm run dev
```

Abra `http://localhost:3000`. O banco libSQL local é criado automaticamente em `data/academia.libsql` no primeiro acesso. Esse arquivo é persistente e ignorado pelo Git. Para usar outro caminho, defina `ACADEMIA_DB_PATH` em `.env.local`.

No modo de desenvolvimento, use as contas abaixo com a senha `demo12345`:

| Papel | E-mail |
| --- | --- |
| Aluna | `aluna@demo.local` |
| Monitor verificado | `monitor@demo.local` |
| Professora verificada | `professora@demo.local` |
| Coordenação | `admin@demo.local` |

A mesma conta pode perguntar e responder. Cadastros novos começam como aluno e podem solicitar o perfil de monitor ou professor na página **Perfil**. A coordenação confere o vínculo informado e aprova ou rejeita a solicitação em **Administração**. Os dados iniciais incluem uma faculdade de demonstração, uma escola, 11 cursos/séries e 49 disciplinas. A coordenação pode cadastrar mais instituições, cursos e disciplinas.

## Fluxos prontos

- Cadastro, login por senha, sessão com cookie HTTP only e logout.
- Catálogo por instituição, curso e disciplina, com dez cursos de demonstração da universidade; no envio de pergunta, a pessoa escolhe o curso e vê somente as disciplinas vinculadas a ele.
- Publicação de perguntas e respostas persistentes; indicação de solução pelo autor; votos úteis únicos por usuário.
- Perfil e atividade com perguntas feitas, respostas dadas e recebidas, disciplinas e soluções.
- Ranking de monitores e professores verificados, calculado a partir das contribuições aprovadas.
- Conversas privadas de estudo com monitores, professores e coordenação verificados, sempre vinculadas a uma disciplina; mensagens sem contexto acadêmico são recusadas e pedidos de aula podem ser enviados, aceitos ou recusados no chat.
- Triagem por regras locais: linguagem ofensiva e conteúdo sexual explícito são bloqueados; perguntas possivelmente fora do ensino e respostas de entretenimento fora de contexto ficam em revisão. Denúncias são analisadas pela coordenação.

A triagem é intencionalmente simples: não usa IA, não cobra por requisição e **não compreende contexto como uma pessoa**. Pode deixar passar conteúdo inadequado ou sinalizar conteúdo legítimo. Por isso existem revisão humana e denúncias.

## Verificar

```powershell
npm test
npm run typecheck
npm run build
```

## Operação e limites

Use `npm run dev` para a apresentação local. Para testar o build com contas fictícias, defina `DEMO_MODE=1` antes de `npm run start`. As contas fictícias e suas senhas **não devem ser usadas em uma publicação pública**. O arquivo `.env.example` lista as variáveis locais e remotas.

No beta remoto, todas as instâncias acessam o mesmo banco Turso por `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Antes de uma abertura ampla, ainda faltam confirmação de e-mail, recuperação de senha, limites distribuídos de tentativas de login e política de privacidade.

Os arquivos `supabase/` e `db/schema.ts` pertencem ao planejamento anterior e **não são usados pela versão libSQL atual**. O chat atual atualiza quando a página é recarregada; anexos e notificações em tempo real não foram incluídos.

## Solicitar disciplina

Na página **Disciplinas**, uma pessoa autenticada pode solicitar uma matéria ausente para um dos cursos da sua instituição. A plataforma compara o nome normalizado dentro do curso e impede solicitações pendentes duplicadas. A coordenação aprova ou rejeita em **Administração**; ao aprovar, informa ou confirma o código e a disciplina entra no catálogo automaticamente.

## Beta remoto

O deploy ativo usa **Vercel Hobby + Turso Free**. Configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` como segredos da Vercel; nunca os adicione ao Git. O roteiro está em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), e os testes de aceitação em [docs/BETA_TESTING.md](docs/BETA_TESTING.md).

Não publique contas demonstrativas, `DEMO_MODE` ou senhas no ambiente público. O seed remoto cria somente catálogo acadêmico.
