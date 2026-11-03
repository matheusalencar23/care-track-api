# Roadmap

Planejamento feito em 02/11/2026. O Care Track é um **prontuário de enfermagem eletrônico**: a enfermeira cadastra pacientes e registra a evolução de cada um com textos, imagens, vídeos e outros arquivos. Marque os checkboxes ao concluir e registre aqui novas decisões.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Dono do paciente | A **enfermeira** que o cadastrou (`Patient.nurseId`). Compartilhamento entre profissionais/equipes fica para depois. |
| Acesso do paciente | **Não existe.** O histórico é de uso exclusivo da enfermeira; há um único tipo de usuário. |
| Tamanho de arquivos | Sem otimização por enquanto: limite generoso por arquivo, configurável por variável de ambiente. |
| Papéis na LGPD | Dados dos pacientes: a enfermeira é **controladora** e o Care Track é **operador**. Dados das enfermeiras (conta, e-mail, COREN): o Care Track é **controlador**. |
| Encarregado (DPO) do Care Track | **Matheus Alencar**, responsável pelo projeto. Precisa de um e-mail exclusivo de privacidade, publicado na política de privacidade. |
| Correção de registros do histórico | **Edição com versões** e **anulação com motivo**; nunca exclusão definitiva pelo app. Detalhes no princípio 2. |
| Armazenamento de arquivos | A definir na Fase 3. Direção: armazenamento de objetos compatível com S3, bucket privado, preferencialmente em região no Brasil; MinIO no ambiente local. |

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

1. **Isolamento por enfermeira.** Toda consulta a pacientes, registros e arquivos filtra por `req.user.id`. Cada rota nova tem teste de integração provando que uma enfermeira não acessa dados de outra.
2. **Histórico corrigível, mas rastreável.** Registros têm autor, COREN e horário definido pelo servidor. Para a enfermeira, editar e "excluir" funcionam normalmente; por baixo, nada é apagado:
   - **Edição com versões:** cada edição guarda a versão anterior (conteúdo, autor, data/hora) e marca o registro como "editado"; a linha do tempo mostra a versão atual e as anteriores ficam acessíveis. Dentro de uma **janela curta após a criação** (proposta: 1 hora, configurável — a confirmar) a edição é livre; depois dela, exige motivo.
   - **Anulação com motivo** no lugar da exclusão (ex.: "registrado no paciente errado"): o registro sai da linha do tempo e das exportações, mas continua guardado e sinalizado como anulado, visível só para a enfermeira.
   - **Mover para o paciente correto:** anula o registro no paciente errado e cria uma cópia no paciente certo com referência ao original, numa única transação.
   - **Registros anulados nunca entram na exportação** do histórico: no caso de paciente errado, o conteúdo é de outra pessoa e exportá-lo seria vazamento.
   - **Sem exclusão definitiva no app.** Se houver obrigação legal de apagar (ordem judicial ou da ANPD), é um procedimento administrativo do operador, registrado na auditoria.
3. **Auditoria de acesso.** Coleção própria, também só de inclusão, com quem acessou qual paciente, registro ou arquivo, e quando.
4. **Arquivos fora do MongoDB.** Bucket privado; upload e download direto pelo cliente com URLs assinadas de curta duração; no MongoDB ficam só os metadados (dono, paciente, tipo, tamanho, hash, chave). Chaves sem dados pessoais. EXIF (incluindo GPS) removido de imagens.
5. **Minimização.** Só dados com finalidade clara; CPF e Cartão SUS opcionais.
6. **Logs sem dados pessoais.** Já é regra no projeto (ver `CLAUDE.md`); vale também para dados de pacientes.

## Fases

### Fase 0 — Base (antes de qualquer dado de paciente)

- [x] Limitar o `authLimiter` ao `signin`; `me` e `signout` passam ao `generalLimiter` (hoje o `/auth/me` estoura com 10 chamadas em 15 min).
- [x] Testes de integração: `supertest` + `mongodb-memory-server`, mock só do `email.service`, projetos separados no Vitest (`test:unit` / `test:integration`), começando pelo fluxo completo de autenticação. Lembrar que o Vitest define `NODE_ENV=test`, então os rate limiters ficam ativos.
- [x] Recuperação de senha (token por e-mail, no mesmo modelo do token de verificação).
- [x] COREN e UF no cadastro da enfermeira.
- [x] Infraestrutura do log de auditoria. Falta, no deploy, dar ao usuário do banco da API só `insert` e `find` na coleção `auditlogs`.
- [x] Conferir a região do cluster no Atlas; migrar para o Brasil se necessário.
- [x] Ajustar `engines` do `package.json` para `^22.14.0 || >=24.10.0` (exigência do semantic-release) e atualizar o Node local.

### Fase 1 — Pacientes

- [x] Cadastro, listagem paginada com busca, consulta e edição dos dados cadastrais.
- [x] Arquivar em vez de excluir.
- [ ] Todas as consultas filtradas por `nurseId`.
- [ ] Registro de consentimento do paciente (ex.: uso de imagem).
- [ ] Auditoria de cada acesso.

### Fase 2 — Histórico em texto

- [ ] Criação de registros com autor, COREN e horário do servidor.
- [ ] Edição com versões (coleção de versões anteriores, marca de "editado") e janela de edição livre configurável; motivo obrigatório fora da janela.
- [ ] Anulação com motivo (`status` ativo/anulado e dados da anulação); anulados fora da linha do tempo, mas consultáveis pela enfermeira.
- [ ] Mover registro para o paciente correto (anulação + cópia com referência, em transação).
- [ ] Linha do tempo paginada por paciente.
- [ ] Tipos de registro (ex.: anotação, evolução), se fizer sentido no uso real.

### Fase 3 — Arquivos

- [ ] Escolher o provedor de armazenamento (preferência por região no Brasil) e adicionar o MinIO ao `docker-compose.yml`.
- [ ] Upload e download com URLs assinadas de curta duração.
- [ ] Validação de tipo e limite de tamanho configurável.
- [ ] Remoção de EXIF/GPS das imagens.
- [ ] Arquivos sempre anexados a um registro do histórico. Arquivos não são editados: ao anular o registro, os anexos são anulados junto; para trocar um arquivo, anula-se e anexa-se de novo.
- [ ] Antivírus (ClamAV) — pode ficar para depois.

### Fase 4 — Governança LGPD

- [ ] E-mail exclusivo de privacidade para o encarregado.
- [ ] Política de privacidade (com o contato do encarregado) e termos de uso com as cláusulas de operador (papéis, finalidade, local dos dados, encerramento de conta).
- [ ] Campo opcional no perfil para a enfermeira informar o contato do encarregado dela.
- [ ] Exportação completa do histórico de um paciente (acesso e portabilidade), sem registros e anexos anulados.
- [ ] Relatório de acessos (a partir do log de auditoria).
- [ ] Política de retenção (mínimo de 20 anos).
- [ ] Relatório de Impacto à Proteção de Dados (RIPD) e plano de resposta a incidentes.
- [ ] Revisão jurídica dos itens acima antes do primeiro paciente real.

### Fase 5 — Deploy

- [ ] Servidor em região no Brasil, HTTPS e gestão de segredos.
- [ ] Backups com restauração testada.
- [ ] Monitoramento e alertas.
- [ ] Etapa de deploy no CD, a partir da imagem publicada no GHCR.

### Depois

- Compartilhamento de pacientes entre profissionais ou equipes (muda o modelo de controlador).
- MFA.
- Assinatura eletrônica qualificada (ICP-Brasil).
- Aplicativo móvel.
