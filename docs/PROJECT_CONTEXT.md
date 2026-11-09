# Contexto do projeto

O Conecta é um fórum acadêmico para estudantes, monitores, professores e coordenação. O mesmo usuário pode perguntar e responder; o conteúdo é organizado por instituição, curso e disciplina.

Stack ativa: Next.js 16, React 19, TypeScript, Tailwind e libSQL assíncrono. O desenvolvimento usa arquivo local; o beta usa Turso Free por variáveis seguras. Autenticação usa `scrypt`, sessão persistida e cookie HTTP-only.

Funcionalidades: cadastro, login, perfis, perguntas, respostas, votos, solução aceita, ranking, catálogo, filtros, notificações, chat acadêmico, pedidos de aula, denúncias, verificação de vínculo e solicitações de disciplinas.

Infraestrutura alvo: Vercel Hobby + Turso Free, custo R$ 0 dentro das cotas. O banco remoto `conecta` foi criado no plano Starter com overages desativados, schema idempotente aplicado e persistência validada com duas contas de smoke test após reinício do servidor.

O Render pago deixou de ser o caminho ativo; sua configuração está arquivada. Docker permanece opcional para testes, não como requisito de produção.

Pendências não bloqueantes: recuperação de senha, confirmação de e-mail, rate limiting distribuído, política de privacidade, monitoramento e chat em tempo real.
