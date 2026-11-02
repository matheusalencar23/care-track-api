# care-track-api

## Requisitos

- Node 22+
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

`NODE_ENV` é opcional e vale `development` por padrão. Em `development` os rate limits ficam desativados; em `production` o cookie de autenticação passa a exigir HTTPS (`secure`).

## Rodando localmente

```bash
npm install
npm run dev
```

## Testes

```bash
npm test # roda os testes
npm run check # lint + test + build
```

Os testes leem as variáveis do arquivo `.env.test` (fora do git), que precisa ter as mesmas chaves do `.env.example`. Nenhum teste acessa o banco ou o Resend de verdade.

Commits seguem o padrão Conventional Commits, validado pelo commitlint — ver [`docs/commits.md`](docs/commits.md).

## Endpoints

Todas as rotas ficam sob o prefixo `/api/v1`. A autenticação é feita por um cookie httpOnly `token` (JWT válido por 1h), gravado no signin; não há header `Authorization`.

| Método | Rota                            | Descrição                              | Autenticado | Rate limit      |
| ------ | ------------------------------- | -------------------------------------- | ----------- | --------------- |
| POST   | `/api/v1/users/signup`          | Cria uma conta                         | não         | 100/h           |
| GET    | `/api/v1/users/validate?token=` | Confirma o e-mail                      | não         | 100/h           |
| POST   | `/api/v1/users/resend`          | Reenvia o e-mail de confirmação        | não         | 100/h e 5/15min |
| POST   | `/api/v1/auth/signin`           | Login, grava o cookie de autenticação  | não         | 10/15min        |
| POST   | `/api/v1/auth/signout`          | Logout, remove o cookie                | sim         | 10/15min        |
| GET    | `/api/v1/auth/me`               | Retorna o usuário autenticado          | sim         | 10/15min        |
| GET    | `/api/v1/health`                | Health check (API e banco)             | não         | —               |

Os limites são por IP e ficam desativados com `NODE_ENV=development`. O login só é aceito depois que o e-mail for confirmado. O `/users/resend` responde 200 mesmo para e-mails não cadastrados (exceto quando estoura o limite por IP, que retorna 429) e só envia um novo e-mail se o anterior tiver mais de 60 segundos.

## Deploy

A cada push na `master`, o GitHub Actions roda o semantic-release (ver `.github/workflows/release-docker.yml`). Se os commits gerarem uma nova versão (`feat`, `fix` ou breaking change), a imagem Docker é publicada em `ghcr.io/matheusalencar23/care-track-api` com a tag da versão e `latest`. Os PRs para a `master` passam pelo `npm run check` no CI.
