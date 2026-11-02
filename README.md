# care-track-api

## Requisitos

- Node 22+ (versão usada no CI e na imagem: `.nvmrc`)
- MongoDB

## Configuração

Copie `.env.example` para `.env` e preencha:

- `PORT` — porta da API (padrão 3001)
- `JWT_SECRET` — segredo usado para assinar os JWTs
- `MONGO_DB_URL_CONNECTION` — string de conexão do MongoDB
- `CORS_ORIGIN` — origem permitida pelo CORS
- `EMAIL_HOST` — URL base usada no link de confirmação de e-mail
- `RESEND_API_KEY` — chave da API do Resend
- `RESEND_EMAIL_ORIGIN` — remetente dos e-mails transacionais

`LOG_LEVEL` é opcional (`debug`, `info`, `warn`, `error`; padrão `info`). `NODE_ENV` é opcional e vale `development` por padrão. Em `development` os rate limits ficam desativados; em `production` o cookie de autenticação passa a exigir HTTPS (`secure`).

## Rodando localmente

Para usar um MongoDB local via Docker, suba o serviço do `docker-compose.yml` e aponte o `.env` para ele (`MONGO_DB_URL_CONNECTION=mongodb://localhost:27017/care-track`):

```bash
docker compose up -d   # sobe só o MongoDB, com os dados em um volume
npm install
npm run dev
```

Para rodar a API também em container, a partir do `Dockerfile` (mesma imagem de produção):

```bash
docker compose --profile app up -d --build
```

Nesse modo, a API usa o Mongo do compose e roda com `NODE_ENV=production`, o que mantém os rate limits ativos. `docker compose down` para tudo; `docker compose down -v` também apaga os dados.

## Testes

```bash
npm test                 # todos os testes
npm run test:unit        # só os unitários
npm run test:integration # só os de integração
npm run check            # lint + test + build
```

Os testes leem as variáveis do arquivo `.env.test`, versionado com valores fictícios e usado também no CI. Ele precisa ter as mesmas chaves obrigatórias do `.env.example`.

- **Unitários** (`tests/`, exceto `tests/integration/`): repositórios e serviços mockados com `vi.mock`, sem banco.
- **Integração** (`tests/integration/`): sobem o `app` com `supertest` contra um MongoDB em memória (`mongodb-memory-server`, que baixa o binário do `mongod` no `npm install`). Cada arquivo usa um banco próprio, limpo depois de cada teste. O único mock é o `email.service` — os testes leem o link enviado a partir das chamadas do mock. O Vitest roda com `NODE_ENV=test`, então os rate limits ficam ativos e os contadores (em memória) duram o arquivo inteiro.

Nenhum teste acessa o Resend ou um banco real.

Commits seguem o padrão Conventional Commits, validado pelo commitlint — ver [`docs/commits.md`](docs/commits.md).

## Endpoints

Todas as rotas ficam sob o prefixo `/api/v1`. A autenticação é feita por um cookie httpOnly `token` (JWT válido por 1h), gravado no signin; não há header `Authorization`.

| Método | Rota                            | Descrição                             | Autenticado | Rate limit       |
| ------ | ------------------------------- | ------------------------------------- | ----------- | ---------------- |
| POST   | `/api/v1/users/signup`          | Cria uma conta                        | não         | 100/h            |
| GET    | `/api/v1/users/validate?token=` | Confirma o e-mail                     | não         | 100/h            |
| POST   | `/api/v1/users/resend`          | Reenvia o e-mail de confirmação       | não         | 100/h e 5/15min  |
| POST   | `/api/v1/auth/signin`           | Login, grava o cookie de autenticação | não         | 100/h e 10/15min |
| POST   | `/api/v1/auth/signout`          | Logout, remove o cookie               | sim         | 100/h            |
| GET    | `/api/v1/auth/me`               | Retorna o usuário autenticado         | sim         | 100/h            |
| GET    | `/api/v1/health`                | Health check (API, banco e versão)    | não         | —                |

Os limites são por IP e ficam desativados com `NODE_ENV=development`. O login só é aceito depois que o e-mail for confirmado. O `/users/resend` responde 200 mesmo para e-mails não cadastrados (exceto quando estoura o limite por IP, que retorna 429) e só envia um novo e-mail se o anterior tiver mais de 60 segundos.

## Deploy

Os PRs para `master` e `develop` passam pelo CI (`.github/workflows/ci.yml`): lint, testes e build, validação das mensagens de commit e build da imagem Docker.

A cada push na `master`, o `release-docker.yml` repete essas verificações e roda o semantic-release. Se os commits gerarem uma nova versão (`feat`, `fix` ou breaking change), o release é criado no GitHub e a imagem Docker é publicada em `ghcr.io/matheusalencar23/care-track-api` com a tag da versão e `latest`. Ainda não há deploy automático: o fluxo termina na publicação da imagem.

As dependências são atualizadas pelo Dependabot (`.github/dependabot.yml`), com PRs semanais para a `develop`.
