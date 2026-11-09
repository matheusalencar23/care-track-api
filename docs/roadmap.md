# Roadmap

Planejamento feito em 02/11/2026. O Care Track é um **prontuário de enfermagem eletrônico**: a enfermeira cadastra pacientes e registra a evolução de cada um com textos, imagens, vídeos e outros arquivos. Marque os checkboxes ao concluir e registre aqui novas decisões.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Dono do paciente | A **enfermeira** que o cadastrou (`Patient.ownerId`). Compartilhamento entre profissionais/equipes fica para depois. |
| Nome do campo de dono | `ownerId`, e não `nurseId`: descreve o papel no dado (quem o controla), não a profissão, e continua correto se outros profissionais usarem o sistema ou se houver compartilhamento. Registros do histórico (Fase 2) terão `ownerId` (escopo de isolamento) separado de `authorId` (quem escreveu). |
| Acesso do paciente | **Não existe.** O histórico é de uso exclusivo da enfermeira; há um único tipo de usuário. |
| Tamanho de arquivos | Sem otimização por enquanto: limite generoso por arquivo, configurável por variável de ambiente. |
| Papéis na LGPD | Dados dos pacientes: a enfermeira é **controladora** e o Care Track é **operador**. Dados das enfermeiras (conta, e-mail, COREN): o Care Track é **controlador**. |
| Encarregado (DPO) do Care Track | **Matheus Alencar**, responsável pelo projeto. Precisa de um e-mail exclusivo de privacidade, publicado na política de privacidade. |
| Correção de registros do histórico | **Edição com versões** e **anulação com motivo**; nunca exclusão definitiva pelo app. Detalhes no princípio 2. |
| Banco de dados | **PostgreSQL 18** (migrado do MongoDB em 03/11/2026, antes do primeiro dado real), com Drizzle ORM. Motivos: transações nativas (escrita + auditoria juntas), isolamento por enfermeira garantido no banco com Row-Level Security, FKs compostas que impedem ligar um registro ao paciente de outra enfermeira, auditoria só de inclusão e ausência de DELETE garantidas por privilégios e triggers. A API conecta com um papel restrito (`care_track_app`); as migrações, com o dono do schema. |
| Estrutura do registro | Um registro é **um item da linha do tempo**, como um comentário num card do Jira: texto e arquivos juntos no mesmo registro. **O registro é imutável:** `records` guarda só a identidade (dono, paciente, autor e `created_at`, todos fixos até para o dono do schema), e o conteúdo fica em `record_versions`, só de inclusão (sem grant de UPDATE/DELETE e trigger que recusa UPDATE/DELETE/TRUNCATE até para o dono do schema). Editar é inserir uma versão nova; o número da versão e o horário são definidos pelo banco, a versão atual é a de maior número, e um trigger adiado impede gravar um registro sem a versão 1 na mesma transação. A versão 1 não tem motivo; as seguintes podem ter, sempre opcional. Assim o id e a posição na linha do tempo não mudam com a edição. A linha do tempo ordena por `records.created_at` (horário do servidor) e `id` (UUID v7) como desempate, com índice `(owner_id, patient_id, created_at DESC, id DESC)` para paginação por cursor. Os anexos (Fase 3) ficam numa tabela própria ligada ao registro por FK composta `(owner_id, record_id)`, e não como itens separados da linha do tempo. Para intercalar texto e arquivos, o `content` da versão referencia os anexos pelo id (formato a definir com o front no item de criação; proposta: Markdown com `attachment:<id>`); o `content` pode ser nulo (registro só com arquivos), mas nunca em branco. Como anexos nunca são apagados, versões antigas do texto continuam apontando para arquivos válidos. |
| Fluxo dos anexos | Decidido em 09/11/2026: **todo arquivo passa pela API**, que controla o que entra no bucket. `POST /patients/:id/attachments` (multipart, campo `file`) recebe o arquivo em disco temporário, detecta o tipo pelo conteúdo, remove os metadados de imagens, calcula o hash e só então grava no bucket; o temporário é apagado ao fim da requisição. O anexo nasce sem registro (`record_id` nulo), e o `POST` do registro recebe `attachmentIds` e faz a ligação na mesma transação. Assim, uma falha no envio nunca deixa um registro com anexo quebrado, e citar o anexo no texto não gera uma versão "editada". A ligação é única: o anexo não muda de registro. O download continua por URL assinada de curta duração, gerada e auditada pela API, sem passar o arquivo por ela. Custo: a API passa a receber o tráfego e precisa de disco temporário. |
| Armazenamento de arquivos | Decidido em 06/11/2026: armazenamento de objetos acessado só pela API do S3 (`@aws-sdk/client-s3`), com o provedor definido pelas variáveis `S3_*`, para trocar de provedor sem mudar código. **Fase de testes: Oracle Cloud Always Free** (Object Storage, 10 GiB grátis), na região `sa-saopaulo-1`, bucket privado `care-track-files` no compartimento `care-track`. A API usa um usuário próprio (`care-track-api`, grupo `care-track-storage`) cuja policy só permite `OBJECT_CREATE`, `OBJECT_READ` e `OBJECT_INSPECT` nesse bucket: sem `OBJECT_DELETE` nem `OBJECT_OVERWRITE`, a credencial da API não apaga nem sobrescreve arquivos. O endpoint é `https://<namespace>.compat.objectstorage.sa-saopaulo-1.oraclecloud.com`, com path-style. A Oracle responde ao CORS liberando qualquer origem, sem configuração por bucket, o que permite baixar direto do navegador por URL assinada. **Ambiente local: SeaweedFS** (`weed mini`, serviço `storage` do compose), porque o MinIO parou de publicar imagens. Rever o provedor antes do primeiro paciente real (limite gratuito, backups, contrato de operador). |

## Leis e regras que orientam o projeto

> Referências levantadas sem revisão jurídica. Números e prazos devem ser confirmados com um advogado especializado antes de entrar o primeiro dado real de paciente (ver Fase 4).

| Regra | Exigência | Impacto no sistema |
|---|---|---|
| LGPD, art. 5º II e art. 11 | Dado de saúde é **dado pessoal sensível**. Base legal provável: tutela da saúde em procedimento realizado por profissional de saúde (art. 11, II, "f"). | Minimização, controle de acesso, auditoria. |
| LGPD, art. 46 a 49; Resolução ANPD 15/2024 | Medidas de segurança; incidentes comunicados à ANPD (prazo de 3 dias úteis). | Criptografia, logs de acesso, plano de resposta a incidentes. |
| LGPD, art. 33 | Transferência internacional exige requisitos adicionais. | Banco e arquivos preferencialmente em região no Brasil. |
| LGPD, art. 14 | Dados de crianças e adolescentes. | Regras próprias para pacientes menores. |
| LGPD, art. 18 e art. 16 | Direitos do titular (acesso, correção, portabilidade); a eliminação não se aplica quando há obrigação legal de guarda. | Exportação do histórico; prontuário não é apagado a pedido. |
| LGPD, art. 41; Resolução ANPD 2/2022 | Controlador indica encarregado. A dispensa para agente de pequeno porte não vale para tratamento de alto risco (dados de saúde costumam se enquadrar). | O sistema facilita o papel da enfermeira como controladora (termos, ferramentas, campo de encarregado). |
| Lei 13.787/2018 | Prontuário digital guardado por **no mínimo 20 anos** após o último registro. | Política de retenção; armazenamento frio para arquivos antigos. |
| Código de Ética da Enfermagem (COFEN 564/2017) e normas de registro do COFEN | Sigilo; registros identificam o profissional (nome e COREN) com data e hora; o registro original não pode desaparecer e correções precisam ser rastreáveis. | Edição com versões e anulação com motivo, sem exclusão definitiva; COREN e UF no cadastro. |
| Código Civil, art. 20; normas do COFEN sobre imagens | Uso de imagem do paciente exige consentimento e finalidade assistencial. | Registro de consentimento; arquivos nunca públicos. |
| Lei 14.063/2020 | Alguns documentos de saúde exigem assinatura qualificada (ICP-Brasil). | Fora do escopo inicial; avaliar se o sistema emitir documentos oficiais. |

## Princípios de arquitetura

1. **Isolamento por enfermeira.** Toda consulta a pacientes, registros e arquivos filtra por `req.user.id` e roda no `withOwnerScope`, que ativa as políticas de RLS da tabela. Cada rota nova tem teste de integração provando que uma enfermeira não acessa dados de outra.
2. **Histórico corrigível, mas rastreável.** Registros têm autor, COREN e horário definido pelo servidor. Para a enfermeira, editar e "excluir" funcionam normalmente; por baixo, nada é apagado:
   - **Edição com versões:** cada edição guarda a versão anterior (conteúdo, autor, data/hora) e marca o registro como "editado"; a linha do tempo mostra a versão atual e as anteriores ficam acessíveis. O registro é **sempre editável**, sem janela de edição livre e sem motivo obrigatório (decidido em 04/11/2026): como nenhuma versão se perde, a rastreabilidade não depende do prazo. O motivo é opcional em qualquer edição.
   - **Anulação com motivo** no lugar da exclusão (ex.: "registrado no paciente errado"): o registro sai da linha do tempo e das exportações, mas continua guardado e sinalizado como anulado, visível só para a enfermeira. O motivo é obrigatório e vem de uma lista (`wrong_patient`, `duplicate`, `other`), com descrição obrigatória em `other`. **A anulação é definitiva**: não pode ser desfeita, e um registro anulado não recebe novas versões (decidido em 04/11/2026).
   - **Sem transferência entre pacientes** (decidido em 04/11/2026): um registro feito no paciente errado é anulado com o motivo `wrong_patient`, e a enfermeira cria um registro novo no paciente certo. Não há cópia nem referência entre os dois.
   - **Registros anulados nunca entram na exportação** do histórico: no caso de paciente errado, o conteúdo é de outra pessoa e exportá-lo seria vazamento.
   - **Sem exclusão definitiva no app.** Se houver obrigação legal de apagar (ordem judicial ou da ANPD), é um procedimento administrativo do operador, registrado na auditoria.
3. **Auditoria de acesso.** Coleção própria, também só de inclusão, com quem acessou qual paciente, registro ou arquivo, e quando.
4. **Arquivos fora do banco.** Bucket privado; o upload passa pela API e o download é direto, por URL assinada de curta duração; no Postgres ficam só os metadados (dono, paciente, tipo, tamanho, hash, chave). Chaves sem dados pessoais. EXIF (incluindo GPS) removido de imagens.
5. **Minimização.** Só dados com finalidade clara; CPF e Cartão SUS opcionais.
6. **Logs sem dados pessoais.** Já é regra no projeto (ver `CLAUDE.md`); vale também para dados de pacientes.

## Fases

### Fase 0 — Base (antes de qualquer dado de paciente)

- [x] Limitar o `authLimiter` ao `signin`; `me` e `signout` passam ao `generalLimiter` (hoje o `/auth/me` estoura com 10 chamadas em 15 min).
- [x] Testes de integração: `supertest` + `mongodb-memory-server`, mock só do `email.service`, projetos separados no Vitest (`test:unit` / `test:integration`), começando pelo fluxo completo de autenticação. Lembrar que o Vitest define `NODE_ENV=test`, então os rate limiters ficam ativos. (Com a migração para o Postgres, o `mongodb-memory-server` deu lugar ao Testcontainers.)
- [x] Recuperação de senha (token por e-mail, no mesmo modelo do token de verificação).
- [x] COREN e UF no cadastro da enfermeira.
- [x] Infraestrutura do log de auditoria. Os privilégios do usuário da API (só SELECT e INSERT na `audit_logs`) agora vêm das migrações.
- [x] Conferir a região do cluster no Atlas; migrar para o Brasil se necessário. (O Atlas saiu com a migração para o Postgres; a escolha do provedor está na Fase 5.)
- [x] Ajustar `engines` do `package.json` para `^22.14.0 || >=24.10.0` (exigência do semantic-release) e atualizar o Node local.

- [x] Documentação da API (adicionada em 04/11/2026, fora do plano original): OpenAPI 3.1 gerado a partir dos schemas Zod de validação, com Swagger UI em `/api/v1/docs`. Desligada em produção por padrão (`API_DOCS_ENABLED`), e testes garantem que toda rota registrada está documentada.
- [x] Sessão deslizante (acordada com o front em 04/11/2026): expira após 30 min sem requisições autenticadas ou 12 h após o login (um plantão), o que vier primeiro. O JWT guarda o horário do login (`auth_time`), cada requisição autenticada renova o cookie e devolve a expiração no header `X-Session-Expires-At`, e o signin e o `/auth/me` trazem `sessionExpiresAt`. A troca de senha passa a comparar o horário do login, e não o `iat`, que muda a cada renovação.
- [x] Rate limit por usuário nas rotas autenticadas (acordado com o front em 04/11/2026): o limite geral de 100/h por IP travava o uso normal do front e seria dividido por todas as enfermeiras de uma instituição atrás do mesmo IP. As rotas autenticadas (`/patients/**`, `/auth/me`, `/auth/signout`) passam ao `userLimiter`, de 300 requisições por minuto por usuário, aplicado depois da autenticação. O limite por IP fica só nas rotas públicas.
- [x] `code` estável nos erros (acordado com o front em 04/11/2026): toda resposta de erro traz `code`, a chave da mensagem em `src/shared/messages.ts`, além da `message` em português. O front decide pelo `code` (ex.: na edição de registro, `RECORD_VERSION_OUTDATED` pede recarga e `PATIENT_ARCHIVED` bloqueia a ação), em vez de comparar textos. As exceções recebem a chave, tipada, e não o texto.
- [x] Erros de validação por campo (acordado com o front em 04/11/2026): os itens do `errors` do 422 passam de texto a `{ location, path, message }`, para o front mostrar cada erro no campo do formulário.
- [x] `trust proxy` configurável pela `TRUST_PROXY` (número de intermediários, padrão `1`, ou lista de IPs/sub-redes confiáveis; `true`/`false` recusados). O valor de produção depende da topologia de deploy (ver Fase 5).

### Fase 1 — Pacientes

- [x] Cadastro, listagem paginada com busca, consulta e edição dos dados cadastrais.
- [x] Arquivar em vez de excluir.
- [x] Todas as consultas filtradas por `ownerId`.
- [x] Registro de consentimento do paciente (ex.: uso de imagem).
- [x] Auditoria de cada acesso.

### Fase 2 — Histórico em texto

- [x] Transações: resolvido com a migração para o PostgreSQL. Cada operação de paciente e consentimento roda num `withOwnerScope`, com a escrita e a auditoria na mesma transação (uma falha na auditoria desfaz a escrita).
- [x] Tabela de registros com `ownerId` e `authorId`, `ownerIsolationPolicy`, FK composta `(owner_id, patient_id)`, trigger de dono imutável e grants por coluna (seguir `patients`/`consents`). Feito no modelo de registro imutável (ver "Estrutura do registro"): `records` (`src/modules/record/`) guarda só a identidade (dono, paciente, autor, horário do servidor), sem nenhuma coluna alterável pela API, e o conteúdo fica em `record_versions`, só de inclusão.
- [x] Criação de registros com autor, COREN e horário do servidor. `POST /patients/:id/records` com `{ content }` (texto livre, até 20 mil caracteres, até o formato ser definido com o front). Cada versão guarda uma cópia do nome, COREN e UF do autor (`author_name`, `author_coren`, `author_coren_state`), conferida por trigger contra o cadastro do usuário no momento da gravação: o registro continua identificando o profissional como ele era, mesmo que o COREN mude depois (ex.: inscrição em outro estado). Paciente arquivado não recebe registros (409). Auditado como `record.create`.
- [x] Edição com versões (inserção em `record_versions`; "editado" = mais de uma versão). Sem janela de edição: sempre editável, motivo opcional. `PUT /patients/:id/records/:recordId` com `{ content, version, reason? }`, em que `version` é a versão que a enfermeira está editando: se outra edição chegou antes, responde 409 (controle de concorrência otimista; duas edições simultâneas da mesma versão também resultam em uma 409, pela chave única `(record_id, version)`). Conteúdo igual ao da versão atual é recusado (422) para não criar versões vazias. `GET /patients/:id/records/:recordId/versions` lista todas as versões, da mais nova para a mais antiga. Paciente arquivado não aceita edição (409), mas as versões continuam consultáveis. Auditados como `record.update` e `record.list_versions`.
- [x] Anulação com motivo. `POST /patients/:id/records/:recordId/void` com `{ reason, details? }`. Colunas em `records` (`voided_at`, `voided_by`, `void_reason`, `void_reason_details`), únicas que a API pode alterar. No banco: horário da anulação definido pelo servidor, anulação definitiva e nenhuma versão nova em registro anulado, até para o dono do schema (o trigger trava a linha do registro, então uma edição concorrente com a anulação também é recusada). Paciente arquivado não aceita anulação (409). Auditado como `record.void`.
- [x] Linha do tempo paginada por paciente. `GET /patients/:id/records?status=active|voided&limit=&cursor=` traz a versão atual de cada registro, do mais novo para o mais antigo (`created_at` e `id` como desempate), com `{ items, nextCursor }`. Paginação por cursor (o id do último registro da página; o banco busca o horário exato dele, já que o JavaScript perde os microssegundos), para que registros criados durante a rolagem não repitam nem pulem itens. Os anulados ficam fora por padrão e são consultados com `status=voided`. Paciente arquivado continua com a linha do tempo visível. Auditado como `record.list`, um registro por listagem (todos os itens são do mesmo paciente).

### Fase 3 — Arquivos

- [x] Escolher o provedor de armazenamento (preferência por região no Brasil) e adicionar o armazenamento local ao `docker-compose.yml` (06/11/2026): Oracle Cloud em São Paulo e SeaweedFS no ambiente local (ver tabela de decisões).
- [x] Container do SeaweedFS nos testes de integração (Testcontainers, `GenericContainer`), junto com a primeira rota de arquivos.
- [x] Upload pela API e download com URL assinada de curta duração (09/11/2026): `POST /patients/:id/attachments` e `GET .../:attachmentId/download`, auditados como `attachment.upload` e `attachment.download`; a ligação ao registro, como `attachment.link`. O `S3Client` usa `requestChecksumCalculation: "WHEN_REQUIRED"`. O valor `attachment.create` do enum ficou sem uso, da primeira versão do fluxo.
- [ ] Validar na Oracle real a gravação feita pela API (`PutObject` com stream). O download e o acesso já foram validados em 09/11/2026.
- [ ] Limpeza de anexos abandonados (sem registro), no banco e no bucket, por um job do operador: a API não tem DELETE no banco nem no bucket. Vale também para o objeto órfão de uma falha entre a gravação no bucket e a transação no banco.
- [x] Hash SHA-256 do arquivo gravado nos metadados (09/11/2026).
- [ ] Citação de anexos no texto: validar `attachment:<id>` no `content` contra os anexos do registro, quando o formato for definido com o front.
- [x] Validação de tipo e limite de tamanho configurável (09/11/2026): o tipo é detectado pelo conteúdo do arquivo (`file-type`), e o declarado pelo cliente é ignorado; lista em `ATTACHMENT_CONTENT_TYPES` (JPEG, PNG, WebP, PDF, MP4, MOV e WebM) e limite em `ATTACHMENT_MAX_SIZE_BYTES` (padrão 200 MiB). HEIC fica de fora até ser testado: o ExifTool o suporta, mas não houve como gerar um arquivo de teste aqui.
- [x] Remoção de EXIF/GPS das imagens (09/11/2026), com o ExifTool, sem reencodar: os pixels não mudam. Mantém só a orientação e o perfil de cor, e confere o resultado antes de gravar; se a remoção falhar, o arquivo é recusado. A imagem Docker precisa do Perl.
- [ ] Metadados de vídeos (MP4 e MOV podem trazer GPS) e de PDFs (autor): ainda são gravados como vieram.
- [x] Arquivos sempre anexados a um registro do histórico (09/11/2026), com o rascunho anterior ao registro como única exceção. Hoje a ligação só acontece na criação do registro. Arquivos não são editados: ao anular o registro, os anexos são anulados junto; para trocar um arquivo, anula-se e anexa-se de novo.
- [ ] Antivírus (ClamAV) — pode ficar para depois.
- [ ] **Comprovação do consentimento** (forma a definir). Hoje o consentimento (Fase 1) só registra tipo, forma de coleta (`written`/`verbal`), quem consentiu e quando, sem prova anexada. Opções levantadas: foto ou digitalização de um termo assinado em papel; assinatura com o dedo na tela (imagem do traço, com data, hora e dispositivo); impressão digital; assinatura eletrônica por um serviço externo. Pontos para a decisão: os níveis de assinatura eletrônica da Lei 14.063/2020 (simples, avançada, qualificada) e qual basta para o consentimento; a impressão digital é dado biométrico, sensível pela LGPD, e exigiria justificativa própria; a prova é exceção à regra "arquivo sempre anexado a um registro do histórico", pois se liga ao consentimento, mas também não pode ser editada nem excluída; se o consentimento `verbal` continua aceito e como comprová-lo (ex.: testemunha). Validar a escolha na revisão jurídica da Fase 4.

### Fase 4 — Governança LGPD

- [ ] E-mail exclusivo de privacidade para o encarregado.
- [ ] Política de privacidade (com o contato do encarregado) e termos de uso com as cláusulas de operador (papéis, finalidade, local dos dados, encerramento de conta).
- [x] Registro do aceite dos termos no cadastro (06/11/2026): `acceptedTermsVersion` obrigatório no signup, gravado em `terms_acceptances` (só de inclusão, horário do servidor). Os textos ficam no front, com os dados do operador e do encarregado ainda como marcadores.
- [ ] Novo aceite quando os termos mudarem: expor no `/auth/me` se a última versão aceita é a atual e uma rota para registrar o aceite de quem já tem conta.
- [ ] Campo opcional no perfil para a enfermeira informar o contato do encarregado dela.
- [ ] Exportação completa do histórico de um paciente (acesso e portabilidade), sem registros e anexos anulados.
- [ ] Relatório de acessos (a partir do log de auditoria).
- [ ] Política de retenção (mínimo de 20 anos).
- [ ] Relatório de Impacto à Proteção de Dados (RIPD) e plano de resposta a incidentes.
- [ ] Revisão jurídica dos itens acima antes do primeiro paciente real.

### Fase 5 — Deploy

- [ ] Servidor em região no Brasil, HTTPS e gestão de segredos.
- [ ] Conferir limites de tamanho e timeout dos intermediários (balanceador, proxy do Next) para o upload de anexos, que passa pela API: precisam aceitar `ATTACHMENT_MAX_SIZE_BYTES`. A API aceita até 30 minutos por requisição. Considerar também o disco temporário do container.
- [ ] Definir a `TRUST_PROXY` conforme os intermediários de produção (balanceador, servidor do Next que repassa `/api/v1` para a API) e conferir, com uma requisição real, que o IP gravado na auditoria é o do navegador. O proxy do Next não acrescenta o `X-Forwarded-For`: alguém confiável antes dele (balanceador ou plataforma) precisa anotar o IP do cliente.
- [ ] Postgres 18 gerenciado em região no Brasil (ex.: RDS, Cloud SQL, Neon, Supabase), com dois usuários: o dono do schema para as migrações e o `care_track_app` (login habilitado com senha forte) para a API. O usuário da API não pode ser superusuário nem dono das tabelas, porque os dois ignoram o RLS.
- [ ] Etapa de migração no deploy (`node dist/db/migrate.js` com a `DATABASE_MIGRATION_URL`) antes de subir a nova versão da API.
- [ ] Limpeza periódica dos tokens de e-mail e de senha expirados (o MongoDB apagava com índice TTL; no Postgres, um job do operador, já que a API não tem DELETE).
- [ ] Backups com restauração testada.
- [ ] Monitoramento e alertas.
- [ ] Etapa de deploy no CD, a partir da imagem publicada no GHCR.

### Depois

- Compartilhamento de pacientes entre profissionais ou equipes (muda o modelo de controlador).
- MFA.
- Assinatura eletrônica qualificada (ICP-Brasil).
- Aplicativo móvel.
- Tipos de registro (ex.: anotação, evolução): sem necessidade por enquanto (decidido em 04/11/2026); reavaliar com o uso real.
