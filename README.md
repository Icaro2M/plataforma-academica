# Conecta Academia

Fórum acadêmico para estudantes, monitores e professores. A versão atual funciona localmente, sem conta em serviço externo e sem custo de API. É um projeto de demonstração, sem vínculo oficial com a Universidade de Fortaleza ou outras instituições citadas nos dados iniciais.

## Executar no VS Code

Requer **Node.js 24** e npm. No terminal da pasta do projeto:

```powershell
npm ci
npm run dev
```

Abra `http://localhost:3000`. O banco SQLite é criado automaticamente em `data/academia.sqlite` no primeiro acesso. Esse arquivo é persistente e ignorado pelo Git. Não execute `git clean -fdx` se quiser preservar os dados. Para usar outro caminho, defina `ACADEMIA_DB_PATH` em `.env.local`.

No modo de desenvolvimento, use as contas abaixo com a senha `demo12345`:

| Papel | E-mail |
| --- | --- |
| Aluna | `aluna@demo.local` |
| Monitor verificado | `monitor@demo.local` |
| Professora verificada | `professora@demo.local` |
| Coordenação | `admin@demo.local` |

A mesma conta pode perguntar e responder. Cadastros novos começam como aluno e podem solicitar o perfil de monitor ou professor na página **Perfil**. A coordenação confere o vínculo informado e aprova ou rejeita a solicitação em **Administração**. Os dados iniciais incluem uma faculdade de demonstração, uma escola, quatro cursos/séries e 14 disciplinas. A coordenação pode cadastrar mais instituições, cursos e disciplinas.

## Fluxos prontos

- Cadastro, login por senha, sessão com cookie HTTP only e logout.
- Catálogo por instituição, curso e disciplina; busca e filtros de perguntas.
- Publicação de perguntas e respostas persistentes; indicação de solução pelo autor; votos úteis únicos por usuário.
- Perfil e atividade com perguntas feitas, respostas dadas e recebidas, disciplinas e soluções.
- Ranking de monitores e professores verificados, calculado a partir das contribuições aprovadas.
- Triagem por regras locais: linguagem ofensiva e conteúdo sexual explícito são bloqueados; perguntas possivelmente fora do ensino e respostas de entretenimento fora de contexto ficam em revisão. Denúncias são analisadas pela coordenação.

A triagem é intencionalmente simples: não usa IA, não cobra por requisição e **não compreende contexto como uma pessoa**. Pode deixar passar conteúdo inadequado ou sinalizar conteúdo legítimo. Por isso existem revisão humana e denúncias.

## Verificar

```powershell
npm test
npm run typecheck
npm run build
```

## Operação e limites

Use `npm run dev` para a apresentação local. Para testar o build com contas fictícias, defina `DEMO_MODE=1` antes de `npm run start`. Fora do modo de demonstração, defina `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` (12 caracteres ou mais) para criar a primeira conta da coordenação. As contas fictícias e suas senhas **não devem ser usadas em uma publicação pública**. O arquivo `.env.example` lista as variáveis opcionais.

SQLite exige disco persistente. Hospedagem sem armazenamento persistente perderá os dados; várias instâncias não devem compartilhar o arquivo pela rede. Esta entrega foi validada para uso local/num único servidor. Antes de publicação pública, faltam confirmação de e-mail, recuperação de senha, limites de tentativas de login, backup, regras de privacidade e uma revisão de dependências.

Os arquivos `supabase/` e `db/schema.ts` pertencem ao planejamento anterior e **não são usados pela versão SQLite atual**. Chat, anexos e notificações em tempo real não foram incluídos no fluxo atual.
