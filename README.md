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

## Rodando localmente

\`\`\`bash
npm install
npm run dev
\`\`\`

## Testes

\`\`\`bash
npm test # roda os testes
npm run check # lint + test + build
\`\`\`

## Endpoints

| Método | Rota                            | Descrição                      | Autenticado |
| ------ | ------------------------------- | ------------------------------ | ----------- |
| POST   | `/api/v1/users/signup`          | Cria uma conta                 | não         |
| POST   | `/api/v1/users/signin`          | Login, retorna cookie httpOnly | não         |
| GET    | `/api/v1/users/validate?token=` | Confirma o e-mail              | não         |
| POST   | `/api/v1/users/resend`          | Reenvia e-mail de confirmação  | não         |
| GET    | `/api/v1/users/me`              | Retorna o usuário autenticado  | sim         |
| GET    | `/api/v1/health`                | Health check                   | não         |

## Deploy

Build de imagem Docker automático via GitHub Actions a cada merge em `master` (ver `.github/workflows/release-docker.yml`), publicado em `ghcr.io/matheusalencar23/care-track-api`.
