# Commits pendentes

Alterações não commitadas organizadas em commits atômicos, do mais independente ao mais dependente.

---

## Commit 1 — Infraestrutura: Valkey via Docker

```
feat(infra): add docker-compose for Valkey and update .env.example
```

**Arquivos:**
- `server/docker-compose.yml` _(novo)_
- `server/.env.example` — adiciona variáveis `VALKEY_HOST` e `VALKEY_PORT`

**Por quê:** provê o ambiente do Valkey via container em vez de dependência externa manual.

---

## Commit 2 — Dependências: troca valkey-glide → ioredis

```
chore(deps): replace @valkey/valkey-glide with ioredis
```

**Arquivos:**
- `server/package.json` — remove `@valkey/valkey-glide`, adiciona `ioredis`
- `server/yarn.lock`
- `server/api-service/services/ValkeyPublisher.ts` — reescreve cliente para `ioredis` (síncrono)
- `server/mqtt-service/index.ts` — migra subscriber para `ioredis`

**Por quê:** `valkey-glide` exigia `await` assíncrono na criação do cliente e não expunha a API padrão de pub/sub do Redis; `ioredis` resolve os dois problemas.

---

## Commit 3 — Fix: schema path e script db:seed

```
fix(db): correct drizzle schema path and db:seed script
```

**Arquivos:**
- `server/drizzle.config.ts` — aponta schema para `shared/db/schema.ts`
- `server/shared/db/seed.ts` — atualiza comentário de execução
- `server/package.json` — corrige script `db:seed` para `tsx shared/db/seed.ts`

---

## Commit 4 — Fix: parse seguro de JSON em HistoryController

```
fix(history): safely parse details JSON in HistoryController
```

**Arquivos:**
- `server/api-service/controllers/HistoryController.ts`

**Por quê:** `JSON.parse` sem try/catch lançava 500 quando `details` estava malformado.

---

## Commit 5 — Fix: getValkeyPublisher síncrono em MeasureController

```
fix(measure): remove unnecessary await from getValkeyPublisher
```

**Arquivos:**
- `server/api-service/controllers/MeasureController.ts`

**Por quê:** após migração para `ioredis`, `getValkeyPublisher()` é síncrono; o `await` anterior causava erro de tipo.

---

## Commit 6 — Feature: PatientDataService + endpoint SSE de chat

```
feat(chat): add streaming SSE endpoint and patient clinical context
```

**Arquivos:**
- `server/api-service/services/PatientDataService.ts` _(novo)_ — busca histórico clínico do DB e formata para contexto do LLM
- `server/api-service/services/LLMChatService.ts` — adiciona `chatStream()`, refatora `#buildPrompt()` com `patientContext`; inclui instruções de formatação Markdown no system prompt
- `server/api-service/services/ChatSessionStore.ts` — adiciona `messageCount` no `list()`; ordena por mais recente
- `server/api-service/controllers/ChatController.ts` — injeta `PatientDataService`; adiciona handler `onMessageStream` (SSE token a token)
- `server/api-service/routes/app/ChatRouter.ts` — registra `POST /message/stream`

---

## Commit 7 — Feature: chat com streaming SSE e renderização Markdown

```
feat(dash-client): add SSE streaming chat with Markdown rendering
```

**Arquivos:**
- `dash-client/src/lib/api.ts` — adiciona `apiStream()` (lê SSE via `ReadableStream`); remove `console.log` de depuração
- `dash-client/src/components/MarkdownMessage.tsx` _(novo)_ — renderiza respostas do assistente com `react-markdown` + GFM; suporta cursor piscante durante streaming
- `dash-client/src/pages/Chat.tsx` — migra para `apiStream`; adiciona criação lazy de sessão, retomada de conversa via `/:id`, botão de cancelar, estado `streamingText`
- `dash-client/src/index.css` — adiciona keyframe `blink` para cursor de streaming
- `dash-client/package.json` — adiciona `react-markdown` e `remark-gfm`

---

## Commit 8 — Feature: página de listagem de conversas

```
feat(dash-client): add ChatList page with delete and session navigation
```

**Arquivos:**
- `dash-client/src/pages/ChatList.tsx` _(novo)_ — lista conversas com preview, data relativa, contagem de mensagens e exclusão com confirmação
- `dash-client/src/routes/router.tsx` — adiciona rotas `/chats` e `/chat/:id`
- `dash-client/src/components/Header.tsx` — adiciona nav link para `/chats` (`MessagesSquare`); refatora lógica de back button

---

## Commit 9 — Chore: remoção de lockfiles raiz

```
chore: remove root lockfiles and add dash-client lockfiles
```

**Arquivos:**
- `package.json` _(removido)_
- `yarn.lock` _(removido)_
- `dash-client/package-lock.json` _(novo)_
- `dash-client/yarn.lock` _(novo)_

**Por quê:** o workspace raiz foi eliminado; cada módulo (`server/`, `dash-client/`) gerencia suas próprias dependências.

---

## Ordem de execução sugerida

```
git add server/docker-compose.yml server/.env.example
git commit -m "feat(infra): add docker-compose for Valkey and update .env.example"

git add server/api-service/services/ValkeyPublisher.ts server/mqtt-service/index.ts server/package.json server/yarn.lock
git commit -m "chore(deps): replace @valkey/valkey-glide with ioredis"

git add server/drizzle.config.ts server/shared/db/seed.ts
git commit -m "fix(db): correct drizzle schema path and db:seed script"

git add server/api-service/controllers/HistoryController.ts
git commit -m "fix(history): safely parse details JSON in HistoryController"

git add server/api-service/controllers/MeasureController.ts
git commit -m "fix(measure): remove unnecessary await from getValkeyPublisher"

git add server/api-service/services/PatientDataService.ts server/api-service/services/LLMChatService.ts server/api-service/services/ChatSessionStore.ts server/api-service/controllers/ChatController.ts server/api-service/routes/app/ChatRouter.ts
git commit -m "feat(chat): add streaming SSE endpoint and patient clinical context"

git add dash-client/src/lib/api.ts dash-client/src/components/MarkdownMessage.tsx dash-client/src/pages/Chat.tsx dash-client/src/index.css dash-client/package.json
git commit -m "feat(dash-client): add SSE streaming chat with Markdown rendering"

git add dash-client/src/pages/ChatList.tsx dash-client/src/routes/router.tsx dash-client/src/components/Header.tsx
git commit -m "feat(dash-client): add ChatList page with delete and session navigation"

git add dash-client/package-lock.json dash-client/yarn.lock
git rm package.json yarn.lock
git commit -m "chore: remove root lockfiles and add dash-client lockfiles"
```
