# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
docker compose up -d   # MongoDB local (porta 27017); --profile app sobe também a API
npm run dev        # tsx em modo watch, carrega o .env (precisa de um MongoDB rodando)
npm run build      # tsc -p tsconfig.build.json -> dist/
npm start          # node dist/server.js
npm run lint       # eslint .
npm test           # vitest run (todos os testes)
npm run test:unit         # projeto "unit" do Vitest
npm run test:integration  # projeto "integration" (MongoDB em memória)
npm run check      # lint + test + build — o que o CI roda nos PRs para master

npx vitest run tests/services/userService.spec.ts   # um único arquivo
npx vitest run -t "should throw when user already exists"   # um único teste pelo nome
```

Os testes carregam as variáveis de ambiente do `.env.test` via `tests/setup.ts` (`process.loadEnvFile`). O `.env.test` é versionado (só valores fictícios) e é o mesmo usado no CI: ao criar uma variável obrigatória nova, adicione-a nele também. O `src/config/secrets.ts` lança erro já no import se `JWT_SECRET`, `MONGO_DB_URL_CONNECTION`, `RESEND_API_KEY`, `RESEND_EMAIL_ORIGIN`, `EMAIL_HOST` ou `PASSWORD_RESET_HOST` estiverem ausentes, então qualquer teste que importe código da aplicação precisa desse arquivo. Os testes nunca acessam um banco real. São dois projetos no `vitest.config.ts`: **unit** (`tests/`, exceto `tests/integration/`), com repositórios e serviços mockados com `vi.mock`; e **integration** (`tests/integration/`), que usa `supertest` sobre o `app` e um `mongodb-memory-server` iniciado uma vez no `globalSetup` — cada arquivo conecta num banco próprio, limpo após cada teste (`tests/integration/setup.ts`). Na integração, o único mock é o `email.service` (automock no setup); os tokens enviados por e-mail são lidos das chamadas do mock (`tests/integration/helpers.ts`). Como o Vitest define `NODE_ENV=test`, os rate limiters ficam ativos; o setup zera os contadores depois de cada teste. Toda rota nova deve ter teste de integração, incluindo o de isolamento entre enfermeiras.

Git hooks (husky): `pre-commit` roda lint + test + build; `commit-msg` roda o commitlint (Conventional Commits, regras em `docs/commits.md`). As mensagens de commit alimentam o semantic-release na `master` (`feat` → minor, `fix` → patch, `!`/`BREAKING CHANGE` → major), que em seguida faz o build e publica a imagem Docker em `ghcr.io/matheusalencar23/care-track-api`. O desenvolvimento acontece na `develop`; os PRs têm como alvo a `master`.

CI/CD (`.github/workflows/`): o `ci.yml` roda em PRs para `master`/`develop` e em push na `develop` — `npm run check`, commitlint sobre os commits do PR (e rejeição de mensagens vazias, que o commitlint ignora) e build da imagem Docker sem push. O `release-docker.yml` (push na `master`) chama o `ci.yml` e só então roda o semantic-release, que também grava a versão no `package.json` do workspace (`@semantic-release/npm` com `npmPublish: false`, sem commit) e publica a imagem no GHCR. Não há deploy: o fluxo termina no GHCR. A versão do Node fica no `.nvmrc` (e no `ARG NODE_VERSION` do Dockerfile, que deve acompanhar).

## Arquitetura

Express 5 + Mongoose + Zod, TypeScript ESM (`"type": "module"`, `NodeNext`). **Imports relativos precisam da extensão `.js`**, mesmo em arquivos `.ts`. O tsconfig é strict, com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`.

- `src/server.ts` — bootstrap: conecta ao Mongo, sobe o servidor e faz o graceful shutdown. `src/app.ts` — pilha de middlewares (helmet, CORS com credentials, json, cookie-parser), monta `routes` em `/api/v1` e registra o `errorMiddleware` por último.
- `src/routes.ts` — monta `/users` e `/auth` com o rate limiter geral, além de `/health`. O `signin` usa também o `authLimiter` (mais restrito), aplicado na própria rota. Rotas que disparam e-mail usam também o `emailLimiter`, aplicado na própria rota. Os rate limiters são ignorados quando `NODE_ENV=development`.
- `src/modules/<feature>/` — camadas por feature: `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts` → `*.model.ts`, com schemas Zod em `*.schema.ts`. Controllers e services são exportados como funções nomeadas (sem classes) e importados como `import * as xService`, o que permite usar `vi.mock` pelo caminho do módulo nos testes.
- Validação: `schemaValidationMiddleware(schema)` valida `{ body, query, params }` de uma vez, então os schemas Zod têm o formato `z.object({ body: ..., query: ... })`. Falhas viram `UnprocessableEntityException` (422).
- Erros: lance subclasses de `HttpException` de `src/shared/exceptions/` (importe pelo barrel `index.js`); os controllers fazem `catch` e chamam `next(err)`. O `errorMiddleware` serializa `HttpException` via `toJson()` e transforma qualquer outro erro em 500. As mensagens para o usuário (em português) ficam em `src/shared/messages.ts`.
- Autenticação: `POST /auth/signin` grava um JWT (1h, payload `{ _id }`) em um cookie httpOnly `token` — não em header bearer. O `authenticationMiddleware` lê o cookie, verifica o token, carrega o usuário e define `req.user = { id, name, email }` (tipado em `src/@types/express/index.d.ts`). O login exige que `emailVerifiedAt` esteja preenchido. Recursos que pertencem a um usuário devem ser sempre filtrados por `req.user.id` nas consultas.
- Fluxo de verificação de e-mail: no signup, o `emailVerificationToken.service` gera um token aleatório, guarda apenas o hash SHA-256 com expiração de 30 min, e o `src/services/email/email.service.ts` envia o token original via Resend como `${EMAIL_HOST}?token=...`. `GET /users/validate` gera o hash do token recebido e checa a expiração e o `usedAt` (`findValidToken`), preenche `user.emailVerifiedAt` e só então marca o token como usado (`markTokenAsUsed`), para que uma falha no meio não invalide o link. `POST /users/resend` sempre responde 200 (para não permitir enumeração de usuários). Os tokens de uso único usam `generateRandomToken`/`hashToken` de `src/utils/crypt.utils.ts`.
- Recuperação de senha: segue o mesmo modelo, com o `passwordResetToken.*` em `src/modules/auth/`. `POST /auth/forgot-password` sempre responde 200 e envia o e-mail sem bloquear a resposta; `POST /auth/reset-password` grava a senha e `user.passwordChangedAt` e só então invalida todos os tokens pendentes do usuário. O `authenticationMiddleware` rejeita JWTs com `iat` anterior ao `passwordChangedAt`, o que derruba as sessões abertas antes da troca.
- O hash de senha (bcrypt) é feito no hook `pre("save")` do model User; a comparação é feita com `user.authenticate(password)`.
- Logging: use o `AppLogger` (`src/shared/appLogger.ts`, pino) em vez de `console`, com a mensagem fixa e os dados no segundo argumento (`AppLogger.info("User created", { userId })`). O `requestLoggerMiddleware` registra cada requisição e o `requestId` entra automaticamente em todos os logs feitos durante ela; nos testes, o mock do `AppLogger` precisa ter `debug`, `info`, `warn` e `error`. Não registre dados pessoais (nome, e-mail e, futuramente, dados de pacientes) nos logs — identifique registros pelo ID (`{userId=...}`), já que a API vai tratar dados de saúde (dado sensível na LGPD).

## Pontos de atenção

O plano do produto, as decisões já tomadas (dono do paciente, papéis na LGPD, encarregado) e as regras legais que orientam o projeto estão em `docs/roadmap.md`. Siga os princípios de arquitetura de lá (isolamento por enfermeira, histórico com edição versionada e anulação em vez de exclusão, auditoria de acesso, arquivos fora do MongoDB) e marque os checkboxes ao concluir itens.

- Os templates HTML de e-mail ficam em `templates/` na raiz e são lidos em tempo de execução via `process.cwd()`, fora do build do `tsc`. Um template novo nessa pasta já entra na imagem (o Dockerfile copia `templates/` no estágio de produção); se mudar o local, ajuste o `COPY` do Dockerfile.
