# Revisão inicial da estrutura

Revisão feita em 01/11/2026 sobre a base atual (cadastro, login, verificação de e-mail). Cada item deve ser corrigido em um commit próprio, seguindo `docs/commits.md`. Marque o checkbox ao concluir.

**Prioridade sugerida para antes do módulo de pacientes:** 1, 2, 3, 4, 6, 8 e 10.

---

## 🔴 Bugs

### [X] 1. Senha com espaço no início ou no fim impede o login

- **Onde:** `src/modules/user/user.model.ts:29`
- **Problema:** o campo `password` tem `trim: true`. No cadastro, o espaço é removido antes do hash; no login, a senha digitada é comparada sem trim. Quem se cadastra com `" minhaSenha"` nunca consegue entrar.
- **Correção:** remover o `trim` do campo `password`.
- **Commit sugerido:** `fix(users): stop trimming password before hashing`

### [X] 2. Cookie JWT adulterado ou inválido retorna 500 em vez de 401

- **Onde:** `src/utils/token.utils.ts:19`
- **Problema:** `verifyToken` só converte `TokenExpiredError` em `UnauthorizedException`. Assinatura inválida ou token malformado (`JsonWebTokenError`) sobem até o `authenticationMiddleware` e viram 500.
- **Correção:** tratar também `jwt.JsonWebTokenError` (que é a classe base de `TokenExpiredError`) como 401.
- **Commit sugerido:** `fix(auth): return 401 for invalid JWT tokens`

### [X] 3. Envio do e-mail de confirmação sem `await`

- **Onde:** `src/modules/user/user.service.ts:25`
- **Problema:** `createUser` chama `createValidationEmail(...)` sem `await`. Se o Resend falhar, o signup responde 201 e o erro vira um `unhandledRejection`, que só aparece no log.
- **Correção:** decidir o comportamento: usar `await` (o signup falha junto com o e-mail) ou deixar sem esperar de propósito, com `.catch` explícito (o usuário pode usar o `/users/resend`).
- **Commit sugerido:** `fix(users): handle confirmation email failure on signup`

### [X] 4. Templates de e-mail não entram na imagem Docker

- **Onde:** `src/services/email/email.service.ts:11` e `Dockerfile`
- **Problema:** os templates são lidos em tempo de execução de `process.cwd()/src/services/email/templates/`. O `tsc` não copia `.html` e a imagem de produção só tem `dist/`, então a confirmação de e-mail deve quebrar em produção.
- **Correção:** copiar `src/services/email/templates` para a imagem no Dockerfile, ou mover os templates para fora de `src/` (ex.: `templates/`) e resolver o caminho de forma independente do build.
- **Commit sugerido:** `fix(email): include email templates in production image`

---

## 🟡 Segurança e LGPD

O projeto vai tratar dados de saúde, classificados como **dado sensível** pela LGPD. Estes pontos devem ser ajustados cedo.

### [X] 5. Logs registram e-mail e nome dos usuários

- **Onde:** `src/modules/user/user.controller.ts:17,38,100`, `src/modules/auth/auth.controller.ts:13`
- **Problema:** dados pessoais aparecem nos logs, como em `Create user {name=..., email=...}`. Quando chegarem os dados de pacientes, esse padrão fica perigoso.
- **Correção:** logar apenas IDs; evitar dados pessoais nas mensagens de log.
- **Commit sugerido:** `fix: remove personal data from logs`
- **Resolução:** as mensagens de log não trazem mais nome nem e-mail; onde há um usuário identificado, o log usa o `userId` (ex.: `User created {userId=...}`). O E11000, que traz o e-mail duplicado na mensagem, foi tratado no item 9.

### [X] 6. Senha sem regra mínima

- **Onde:** `src/modules/user/user.schema.ts:7`
- **Problema:** a senha aceita qualquer valor não vazio, por exemplo `"a"`.
- **Correção:** exigir pelo menos 8 caracteres (`.min(8, ...)`) no `SignupSchema`.
- **Commit sugerido:** `feat(users): enforce minimum password length`
- **Resolução:** `SignupSchema` exige de 8 a 72 caracteres (72 é o limite do bcrypt). O `SigninSchema` não aplica a regra, para que contas antigas com senha curta continuem entrando. Testes em `tests/schemas/userSchema.spec.ts`.

### [X] 7. `/users/resend` sem limite específico

- **Onde:** `src/routes.ts:12`, `src/modules/user/user.routes.ts`
- **Problema:** a rota só tem o `generalLimiter` (100 requisições por hora), o que permite disparar muitos e-mails para o mesmo endereço.
- **Correção:** aplicar o `authLimiter` (ou um limiter próprio) no `/resend`, e/ou limitar o reenvio por e-mail (ex.: um a cada 60s).
- **Commit sugerido:** `fix(users): rate limit confirmation email resend`
- **Resolução:** duas camadas. Por IP: `emailLimiter` (5 requisições a cada 15 min, contador próprio) na rota `/resend`. Por usuário: `isOnResendCooldown` bloqueia um novo envio se o último token foi criado há menos de 60s (`RESEND_COOLDOWN_MS`), lançando `TooManyRequestsException`. O controller continua respondendo 200 em qualquer caso, para não permitir enumeração.

### [X] 8. `req.user` não guarda o `_id` do usuário

- **Onde:** `src/modules/auth/auth.middleware.ts:35`, `src/@types/express/index.d.ts`
- **Problema:** o middleware só expõe `name` e `email`. Toda consulta de paciente vai precisar filtrar pela enfermeira dona do registro.
- **Correção:** incluir `id` em `req.user` e no tipo global.
- **Commit sugerido:** `feat(auth): expose user id on authenticated requests`
- **Resolução:** `req.user` agora é `{ id, name, email }` (`id` como string, via `user.id` do Mongoose). A resposta do `GET /auth/me` não mudou.

### [X] 9. E-mail duplicado em cadastros simultâneos retorna 500

- **Onde:** `src/middlewares/error.middleware.ts`
- **Problema:** a checagem `findByEmail` e o `save` não são atômicos. Dois cadastros simultâneos com o mesmo e-mail estouram com erro E11000 (chave duplicada) do Mongo e retornam 500.
- **Correção:** tratar o código `11000` no `errorMiddleware` (ou no repository), retornando 400/409.
- **Commit sugerido:** `fix: handle mongo duplicate key errors`
- **Resolução:** `userRepository.save` converte o erro de chave duplicada (helper `isDuplicateKeyError` em `src/utils/mongo.utils.ts`) no mesmo `BadRequestException` do e-mail já cadastrado. Como fallback para outros índices únicos, o `errorMiddleware` responde 409 (`ConflictException`) sem repassar nem logar a mensagem original, que contém o valor duplicado. Isso também resolve a pendência do item 5 para esse erro.

---

## 🟢 Melhorias de estrutura

### [X] 10. Código morto em `user.controller.ts`

- **Onde:** `src/modules/user/user.controller.ts` (`signin` e `me`)
- **Problema:** os handlers não estão mais em nenhuma rota; os que estão em uso ficam em `auth.controller.ts`.
- **Correção:** remover os handlers e ajustar `tests/controllers/userController.spec.ts`, se necessário.
- **Commit sugerido:** `refactor(users): remove unused auth handlers`
- **Resolução:** `signin` e `me` removidos do `user.controller.ts`. Os testes deles foram movidos para `tests/controllers/authController.spec.ts`, agora contra o `auth.controller.ts` (que não tinha testes), e ganharam um caso para o `signout`.

### [X] 11. README desatualizado

- **Onde:** `README.md` (tabela de endpoints)
- **Problema:** `signin` e `me` aparecem em `/users`, mas estão em `/api/v1/auth`; o `POST /auth/signout` não aparece.
- **Commit sugerido:** `docs: update endpoints table`
- **Resolução:** tabela de endpoints corrigida (rotas de auth em `/api/v1/auth`, `signout` incluído, coluna de rate limit), blocos de código que estavam escapados (`\`\`\``) corrigidos, `NODE_ENV` e `.env.test` documentados e seção de deploy ajustada: a imagem só é publicada quando o semantic-release gera versão.

### [X] 12. Logger limitado

- **Onde:** `src/shared/appLogger.ts`, `src/middlewares/error.middleware.ts`
- **Problema:** o `AppLogger` só aceita string e não tem `warn` nem `debug`. Não há log por requisição nem request id. O `errorMiddleware` registra 4xx como `error`.
- **Correção:** aceitar objetos (log estruturado), adicionar `warn`/`debug`, usar `pino-http` com request id e registrar 4xx como `warn`.
- **Commit sugerido:** `feat: improve structured logging`
- **Resolução:** `AppLogger` com `debug`/`info`/`warn`/`error` e contexto estruturado (`AppLogger.info("User created", { userId })`), nível configurável por `LOG_LEVEL`. Em vez do `pino-http`, um `requestLoggerMiddleware` próprio (sem dependência nova): gera ou reaproveita o `x-request-id`, devolve no header da resposta e registra método, caminho sem query string (o `/users/validate` leva o token na query), status e duração. O `requestId` entra em todas as linhas de log da requisição via `AsyncLocalStorage` (`src/shared/requestContext.ts`). O `errorMiddleware` registra 4xx como `warn`. Pendente: os demais logs ainda interpolam `${err}` na mensagem em vez de usar o contexto.

### [ ] 13. Faltam testes de integração

- **Onde:** `tests/`
- **Problema:** todos os testes mockam repositories e services; rotas, middlewares e banco nunca são testados juntos.
- **Correção:** adicionar `supertest` + `mongodb-memory-server` e cobrir os fluxos de cadastro, verificação e login de ponta a ponta.
- **Commit sugerido:** `test: add integration tests for auth flow`

### [ ] 14. Falta `docker-compose.yml` para desenvolvimento local

- **Problema:** é preciso ter um MongoDB rodando à parte para usar o `npm run dev`.
- **Correção:** criar um `docker-compose.yml` com o serviço do MongoDB (e, opcionalmente, a API).
- **Commit sugerido:** `chore: add docker compose for local development`

### [ ] 15. Pequenos ajustes

- [ ] Remover `@types/mongoose` e `@types/pino` do `package.json`: são pacotes obsoletos, as duas bibliotecas já trazem os próprios tipos. (`chore: remove deprecated type packages`)
- [ ] Corrigir `"main": "src/server.js"` em `package.json:5`, que aponta para um arquivo inexistente (deveria ser `dist/server.js`). (`chore: fix package main entry`)
- [ ] Em `validateUser` (`src/modules/user/user.service.ts:30-39`), o token é marcado como usado antes de checar se o usuário existe; se o usuário não existir, a rota responde 200 sem fazer nada. (`fix(users): validate user before consuming token`)
