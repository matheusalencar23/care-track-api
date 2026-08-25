# Convenção de Commits

Este projeto utiliza [Conventional Commits](https://www.conventionalcommits.org/) para padronizar as mensagens de commit.

Além de manter o histórico do projeto organizado, essa convenção permite automatizar futuramente o versionamento da aplicação e a geração de releases.

## Formato

A estrutura básica de um commit é:

```text
tipo: descrição
```

Também é possível especificar um escopo:

```text
tipo(escopo): descrição
```

Exemplos:

```text
feat: add password recovery
```

```text
fix(auth): prevent expired token from being accepted
```

A descrição deve ser curta, objetiva e escrita preferencialmente no imperativo.

---

## Tipos de commit

### `feat`

Utilize quando adicionar uma nova funcionalidade à aplicação.

```text
feat: add user profile endpoint
```

```text
feat(auth): add refresh token
```

**Impacto no versionamento:** `MINOR`

```text
1.2.0 → 1.3.0
```

---

### `fix`

Utilize quando corrigir um problema ou comportamento incorreto.

```text
fix: correct password validation
```

```text
fix(auth): reject expired tokens
```

**Impacto no versionamento:** `PATCH`

```text
1.2.0 → 1.2.1
```

---

### `refactor`

Utilize para alterações internas no código que não adicionam uma funcionalidade nem corrigem um bug.

```text
refactor: simplify authentication middleware
```

```text
refactor(users): extract user validation
```

Use este tipo quando o comportamento externo da aplicação permanece essencialmente o mesmo.

---

### `test`

Utilize quando adicionar ou modificar testes.

```text
test: add user service tests
```

```text
test(auth): add token expiration tests
```

---

### `docs`

Utilize para alterações exclusivamente relacionadas à documentação.

```text
docs: add API setup instructions
```

```text
docs: document environment variables
```

---

### `style`

Utilize para alterações de formatação que não modificam o comportamento da aplicação.

Exemplos:

```text
style: format source files
```

```text
style: fix indentation
```

Alterações relacionadas ao ESLint ou formatação podem utilizar este tipo quando não houver mudança de comportamento.

---

### `chore`

Utilize para tarefas de manutenção que não alteram diretamente a funcionalidade da aplicação.

Exemplos:

```text
chore: update dependencies
```

```text
chore: update Docker configuration
```

```text
chore: configure GitHub Actions
```

---

### `perf`

Utilize quando uma alteração melhora o desempenho da aplicação.

```text
perf: optimize user query
```

```text
perf(db): add index to email field
```

---

### `ci`

Utilize para alterações relacionadas à integração e entrega contínuas.

```text
ci: add GitHub Actions workflow
```

```text
ci: publish Docker image to GHCR
```

---

### `build`

Utilize para alterações relacionadas ao sistema de build ou dependências de build.

```text
build: update TypeScript configuration
```

```text
build: configure production Docker image
```

---

## Breaking Changes

Quando uma alteração quebra compatibilidade com versões anteriores, utilize `!` depois do tipo ou do escopo.

Exemplo:

```text
feat!: change authentication response
```

Ou:

```text
feat(auth)!: change token response format
```

Uma breaking change também pode ser documentada explicitamente no corpo do commit:

```text
feat(auth): change authentication response

BREAKING CHANGE: authentication now returns the token through an HTTP-only cookie.
```

**Impacto no versionamento:** `MAJOR`

```text
1.5.0 → 2.0.0
```

---

# Como escolher o tipo?

Use esta pergunta como referência:

| Situação                                       | Tipo                    |
| ---------------------------------------------- | ----------------------- |
| Nova funcionalidade                            | `feat`                  |
| Correção de bug                                | `fix`                   |
| Alteração interna sem mudança de comportamento | `refactor`              |
| Adição ou alteração de testes                  | `test`                  |
| Documentação                                   | `docs`                  |
| Formatação                                     | `style`                 |
| Manutenção geral                               | `chore`                 |
| Melhoria de performance                        | `perf`                  |
| GitHub Actions / CI/CD                         | `ci`                    |
| Build / configuração de build                  | `build`                 |
| Alteração incompatível                         | `!` / `BREAKING CHANGE` |

---

# Exemplos para este projeto

### Nova funcionalidade

```text
feat(users): add user registration
```

### Correção

```text
fix(auth): reject invalid JWT tokens
```

### Teste

```text
test(users): add create user tests
```

### Refatoração

```text
refactor(auth): extract token validation
```

### Docker

```text
build: optimize production Docker image
```

### CI/CD

```text
ci: publish Docker image to GHCR
```

### Dependências

```text
chore: update dependencies
```

### Documentação

```text
docs: document local development setup
```

### Breaking change

```text
feat(api)!: change user response format
```

---

# Escopo

O escopo é opcional e serve para indicar qual parte da aplicação foi alterada.

Por exemplo:

```text
feat(auth): add refresh token
```

```text
fix(users): prevent duplicate email
```

```text
test(token): add expiration tests
```

Não é necessário utilizar escopo em todos os commits.

Escolha um escopo que seja curto e represente claramente a área afetada.

---

# Boas práticas

### Prefira commits pequenos

Evite:

```text
feat: update everything
```

Prefira separar alterações independentes:

```text
feat(auth): add refresh token
test(auth): add refresh token tests
docs(auth): document refresh token
```

---

### Escreva uma descrição objetiva

Evite:

```text
fix: fiz algumas alterações no login
```

Prefira:

```text
fix(auth): reject invalid credentials
```

---

### Use o imperativo

Prefira:

```text
feat: add user endpoint
```

Em vez de:

```text
feat: added user endpoint
```

A ideia é interpretar a mensagem como uma instrução:

> "Este commit vai adicionar o endpoint de usuário."

---

### Não use mensagens genéricas

Evite:

```text
fix: fix
```

```text
chore: changes
```

```text
feat: updates
```

A mensagem deve permitir entender o que foi alterado sem precisar abrir o diff.

---

# Validação automática

O projeto utiliza **commitlint** para validar as mensagens de commit.

Portanto, commits como:

```text
feat: add login
```

serão aceitos.

Enquanto mensagens como:

```text
adicionando login
```

serão rejeitadas.

A validação acontece automaticamente através do Git hook `commit-msg`.

---

# Relação com o versionamento

Esta convenção também prepara o projeto para o uso de **Semantic Release**.

A partir dos commits, será possível determinar automaticamente a próxima versão:

```text
fix
 ↓
PATCH

feat
 ↓
MINOR

BREAKING CHANGE
 ↓
MAJOR
```

Exemplo:

```text
1.4.0
  │
  ├── fix: correct authentication
  │       ↓
  │     PATCH
  │
  └── resultado: 1.4.1
```

Outro exemplo:

```text
1.4.1
  │
  ├── feat: add password recovery
  │       ↓
  │     MINOR
  │
  └── resultado: 1.5.0
```

E:

```text
1.5.0
  │
  ├── feat!: change authentication contract
  │       ↓
  │     MAJOR
  │
  └── resultado: 2.0.0
```

Por isso, seguir esta convenção corretamente é importante para o funcionamento futuro da pipeline de releases.

---

# Resumo rápido

```text
feat       → nova funcionalidade
fix        → correção
refactor   → refatoração
test       → testes
docs       → documentação
style      → formatação
chore      → manutenção
perf       → performance
ci         → CI/CD
build      → build
!          → breaking change
```

Exemplo de um commit ideal:

```text
feat(auth): add refresh token
```
