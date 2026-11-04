# care-track-api

## Requisitos

- Node `^22.14.0 || >=24.10.0` (exigência do semantic-release). O CI e a imagem usam o Node 24 (`.nvmrc`), que traz o npm 11 — a mesma versão major com que o Dependabot gera o `package-lock.json`
- PostgreSQL 18 (usa `uuidv7()`)
- Docker, para o Postgres local e para os testes de integração

## Configuração

Copie `.env.example` para `.env` e preencha:

- `PORT` — porta da API (padrão 3001)
- `JWT_SECRET` — segredo usado para assinar os JWTs
- `DATABASE_URL` — conexão da API, com o usuário `care_track_app` (sem DELETE e sujeito às políticas de RLS)
- `DATABASE_MIGRATION_URL` — conexão do dono do schema, usada só pelo `npm run db:migrate`
- `CORS_ORIGIN` — origem permitida pelo CORS
- `EMAIL_VERIFICATION_URL` — URL da página do front-end que confirma o e-mail; o link enviado é `EMAIL_VERIFICATION_URL?token=...`
- `PASSWORD_RESET_HOST` — URL base usada no link de redefinição de senha
- `RESEND_API_KEY` — chave da API do Resend
- `RESEND_EMAIL_ORIGIN` — remetente dos e-mails transacionais

`TRUST_PROXY` é opcional e diz em quais intermediários (balanceador, servidor do front) a API confia para descobrir o IP do cliente pelo header `X-Forwarded-For`. Esse IP vai para o log de auditoria e para os rate limits por IP. Aceita o número de intermediários entre o cliente e a API (padrão `1`) ou uma lista de IPs/sub-redes confiáveis (ex.: `10.0.0.0/8, loopback`), que é a opção mais segura quando os endereços são conhecidos. `true`/`false` são recusados: confiar em qualquer um permitiria forjar o IP. Com o valor errado, ou todos os acessos aparecem com o IP do intermediário (o limite de login passa a ser dividido por todos os usuários), ou o cliente consegue inventar o próprio IP.

`LOG_LEVEL` é opcional (`debug`, `info`, `warn`, `error`; padrão `info`). `NODE_ENV` é opcional e vale `development` por padrão. Em `development` os rate limits ficam desativados; em `production` o cookie de autenticação passa a exigir HTTPS (`secure`).

## Rodando localmente

Suba o Postgres do `docker-compose.yml` e aponte o `.env` para ele:

```
DATABASE_URL=postgres://care_track_app:care_track_app@localhost:5432/care_track
DATABASE_MIGRATION_URL=postgres://care_track:care_track@localhost:5432/care_track
```


```bash
docker compose up -d   # sobe só o Postgres, com os dados em um volume
npm install
npm run db:migrate     # cria as tabelas, as políticas e os privilégios
npm run dev
```

O compose cria dois usuários: `care_track` (dono do schema, só para as migrações) e `care_track_app` (o da API). Em outros ambientes, a primeira migração cria o papel `care_track_app` sem login; habilite-o com uma senha forte antes de subir a API:

```sql
ALTER ROLE care_track_app WITH LOGIN PASSWORD '...';
```

O usuário da API nunca deve ser o dono das tabelas nem superusuário: os dois ignoram as políticas de RLS.

Para mudar o schema, altere os `*.model.ts` e rode `npm run db:generate`, que gera a migração SQL em `migrations/`. Privilégios, triggers e funções vão em migrações SQL escritas à mão (`npx drizzle-kit generate --custom --name=...`).

Para rodar a API também em container, a partir do `Dockerfile` (mesma imagem de produção):

```bash
docker compose --profile app up -d --build
```

Nesse modo, o serviço `migrate` aplica as migrações (`node dist/db/migrate.js`) antes de a API subir; a API usa o Postgres do compose e roda com `NODE_ENV=production`, o que mantém os rate limits ativos. `docker compose down` para tudo; `docker compose down -v` também apaga os dados.

## Testes

```bash
npm test                 # todos os testes
npm run test:unit        # só os unitários
npm run test:integration # só os de integração
npm run check            # lint + test + build
```

Os testes leem as variáveis do arquivo `.env.test`, versionado com valores fictícios e usado também no CI. Ele precisa ter as mesmas chaves obrigatórias do `.env.example`.

- **Unitários** (`tests/`, exceto `tests/integration/`): repositórios e serviços mockados com `vi.mock`, sem banco.
- **Integração** (`tests/integration/`): sobem o `app` com `supertest` contra um Postgres 18 em container (Testcontainers; precisa do Docker rodando). As migrações rodam uma vez num banco modelo, e cada arquivo usa um banco próprio criado a partir dele, limpo depois de cada teste. A API conecta com o mesmo usuário restrito de produção. O único mock é o `email.service` — os testes leem o link enviado a partir das chamadas do mock. O Vitest roda com `NODE_ENV=test`, então os rate limits ficam ativos; os contadores são zerados depois de cada teste.

Nenhum teste acessa o Resend ou um banco real.

Commits seguem o padrão Conventional Commits, validado pelo commitlint — ver [`docs/commits.md`](docs/commits.md).

## Endpoints

Todas as rotas ficam sob o prefixo `/api/v1`. A autenticação é feita por um cookie httpOnly `token` (JWT), gravado no signin; não há header `Authorization`. A sessão é deslizante: cada requisição autenticada a renova, e ela expira após 30 minutos sem requisições ou 12 horas após o login. A expiração vem no header `X-Session-Expires-At` e no campo `sessionExpiresAt` do signin e do `/auth/me`.

Os erros respondem `{ code, message, timestamp }` (o 422 de validação traz também `errors`, uma lista de `{ location, path, message }` em que `location` é `body`, `query` ou `params` e `path` é o campo, como `representativeName` ou `items.0.name`; o 429 e o 500 vêm só com `code` e `message`). O `code` é um identificador estável (ex.: `PATIENT_ARCHIVED`, `RECORD_VERSION_OUTDATED`), feito para o cliente decidir o que fazer; a `message` é o texto em português para exibir ao usuário e pode mudar. A lista completa de códigos está no schema `Error` do OpenAPI.

| Método | Rota                                              | Descrição                               | Autenticado | Rate limit       |
| ------ | ------------------------------------------------- | --------------------------------------- | ----------- | ---------------- |
| POST   | `/api/v1/users/signup`                            | Cria uma conta                          | não         | 100/h            |
| GET    | `/api/v1/users/validate?token=`                   | Confirma o e-mail                       | não         | 100/h            |
| POST   | `/api/v1/users/resend`                            | Reenvia o e-mail de confirmação         | não         | 100/h e 5/15min  |
| POST   | `/api/v1/auth/signin`                             | Login, grava o cookie de autenticação   | não         | 100/h e 10/15min |
| POST   | `/api/v1/auth/forgot-password`                    | Envia o link de redefinição de senha    | não         | 100/h e 5/15min  |
| POST   | `/api/v1/auth/reset-password`                     | Define a nova senha a partir do token   | não         | 100/h e 10/15min |
| POST   | `/api/v1/auth/signout`                            | Logout, remove o cookie                 | sim         | 300/min/usuário  |
| GET    | `/api/v1/auth/me`                                 | Retorna o usuário autenticado           | sim         | 300/min/usuário  |
| POST   | `/api/v1/patients`                                | Cadastra um paciente                    | sim         | 300/min/usuário  |
| GET    | `/api/v1/patients`                                | Lista pacientes (paginada, com busca)   | sim         | 300/min/usuário  |
| GET    | `/api/v1/patients/:id`                            | Consulta um paciente                    | sim         | 300/min/usuário  |
| PUT    | `/api/v1/patients/:id`                            | Edita os dados cadastrais               | sim         | 300/min/usuário  |
| POST   | `/api/v1/patients/:id/archive`                    | Arquiva um paciente                     | sim         | 300/min/usuário  |
| POST   | `/api/v1/patients/:id/unarchive`                  | Reativa um paciente arquivado           | sim         | 300/min/usuário  |
| GET    | `/api/v1/patients/:id/consents`                   | Histórico de consentimentos do paciente | sim         | 300/min/usuário  |
| POST   | `/api/v1/patients/:id/consents`                   | Registra um consentimento               | sim         | 300/min/usuário  |
| POST   | `/api/v1/patients/:id/consents/:consentId/revoke` | Revoga um consentimento                 | sim         | 300/min/usuário  |
| GET    | `/api/v1/health`                                  | Health check (API, banco e versão)      | não         | —                |

Nas rotas públicas, os limites são por IP. Nas autenticadas, o limite é por usuário (300 requisições por minuto) e não consome o limite por IP, porque numa instituição todos os profissionais podem sair pelo mesmo IP. Todos ficam desativados com `NODE_ENV=development`. O login só é aceito depois que o e-mail for confirmado. O `/users/resend` responde 200 mesmo para e-mails não cadastrados (exceto quando estoura o limite por IP, que retorna 429) e só envia um novo e-mail se o anterior tiver mais de 60 segundos.

O `signup` recebe `{ name, email, password, coren, corenState }`: `coren` é o número de inscrição (só dígitos) e `corenState` a UF do conselho regional (`SP`, `RJ`...). Os dois voltam também no `/auth/me` e identificam a enfermeira como autora dos registros.

Recuperação de senha: o `/auth/forgot-password` segue as mesmas regras do `/users/resend` (sempre 200, intervalo de 60 segundos) e envia um link `PASSWORD_RESET_HOST?token=...` válido por 30 minutos. O front-end envia esse token com a nova senha (`{ token, password }`) ao `/auth/reset-password`. A troca invalida todos os links de redefinição pendentes e todas as sessões abertas antes dela; se o e-mail ainda não tinha sido confirmado, passa a constar como confirmado (o link chegou por ele).

Pacientes: cada paciente pertence à enfermeira que o cadastrou, e as rotas só enxergam os pacientes da enfermeira autenticada (o de outra responde 404). O `POST` e o `PUT` recebem `{ name, birthDate, cpf?, cns?, phone? }`: `birthDate` no formato `AAAA-MM-DD`; `cpf` (11 dígitos, com dígitos verificadores), `cns` (Cartão SUS, 15 dígitos) e `phone` (DDD + número, 10 ou 11 dígitos) são opcionais e só com números. O `PUT` substitui os dados cadastrais: um campo opcional omitido é apagado. CPF e Cartão SUS não se repetem entre os pacientes de uma mesma enfermeira (409). A listagem aceita `?search=&status=&page=&limit=` (padrão `status=active`, `page=1`, `limit=20`, máximo 100), ordena por nome e responde `{ items, page, limit, total, totalPages }`; a busca ignora acentos e maiúsculas e, se tiver só números (pontuação é ignorada), procura também pelo CPF ou Cartão SUS exatos. Pacientes não são excluídos, só arquivados: o arquivado sai da listagem padrão (aparece com `status=archived`), continua consultável pelo `GET /patients/:id` (com `archivedAt` preenchido) e não pode ser editado (409) até ser reativado. Arquivar um paciente já arquivado, ou reativar um ativo, também responde 409. O CPF e o Cartão SUS de um paciente arquivado continuam reservados: para voltar a atendê-lo, reative o cadastro. Todo acesso a paciente é registrado no log de auditoria; na listagem, um registro por paciente exibido.

Consentimentos: registram a autorização do paciente para usos que exigem consentimento próprio, como a captura de imagens (fotos e vídeos) para fins assistenciais (`type: "image_capture"`, por enquanto o único tipo). O `POST` recebe `{ type, method, grantor, representativeName?, collectedAt? }`: `method` é a forma de coleta (`written` ou `verbal`); `grantor` é quem consentiu (`patient` ou `legal_representative`, este com `representativeName` obrigatório); `collectedAt` é a data e hora da coleta em ISO 8601 (padrão: agora; não pode estar no futuro). Paciente menor de 18 anos na data da coleta só aceita consentimento do responsável legal (422). Só pode haver um consentimento ativo por tipo (409); para mudar, revogue e registre outro. O consentimento não é editado nem excluído: a revogação (`{ reason? }` opcional) marca `status: "revoked"` e `revokedAt`, e o histórico completo continua na listagem, do mais recente para o mais antigo. Paciente arquivado não recebe consentimento novo (409), mas os existentes continuam consultáveis e revogáveis. Todo acesso é registrado no log de auditoria.

## Deploy

Os PRs para `master` e `develop` passam pelo CI (`.github/workflows/ci.yml`): lint, testes e build, validação das mensagens de commit e build da imagem Docker.

A cada push na `master`, o `release-docker.yml` repete essas verificações e roda o semantic-release. Se os commits gerarem uma nova versão (`feat`, `fix` ou breaking change), o release é criado no GitHub e a imagem Docker é publicada em `ghcr.io/matheusalencar23/care-track-api` com a tag da versão e `latest`. Ainda não há deploy automático: o fluxo termina na publicação da imagem.

As dependências são atualizadas pelo Dependabot (`.github/dependabot.yml`), com PRs semanais para a `develop`.
