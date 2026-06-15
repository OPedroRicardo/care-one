# Care One

Projeto acadêmico para FIAP: plataforma de saúde preditiva com Totem de triagem,
API com IA (RAG + LLM, score NEWS2, wearables) e dashboards para Operadora,
Médico e Paciente.

## Estrutura do Projeto

```
care-one/
├── server/        # Backend Express/TypeScript (API + MQTT)
├── dash-client/   # Dashboards web (Operadora / Médico / Paciente)
├── totem-client/  # Frontend React/Vite do Totem de triagem
├── analysis/      # Scripts Python de análise/geração de dados
└── docs/          # POCs de IA e materiais de pitch
```

### 1. `server/` — API Principal

- **Tecnologia:** Express 5 + TypeScript, Drizzle ORM (SQLite/libsql), MQTT, Valkey/Redis.
- **Função:** sinais vitais e score NEWS2 do Totem, chat clínico com RAG + LLM (Ollama),
  agendas, exames (com geração de PDF), notificações e integração com wearables.
- **Estrutura (`api-service/`):**
  - `routes/totem/`: `MeasureRouter`, `ScoreRouter`, `TotemRouter` — ingestão de
    medições e cálculo do score do Totem.
  - `routes/app/`: rotas do app web, montadas em `/app` pelo `AppRouter`:
    - `AuthRouter`, `HistoryRouter`, `OperadoraRouter`, `AppointmentRouter`,
      `ExamRouter`, `MedicoRouter`, `PatientRouter`, `PacienteRouter`,
      `NotificationRouter`.
  - `controllers/`: regra de negócio por domínio (Score, History, Operadora,
    Medico, Patient, Appointment, Exam, Notification, Chat, PatientConversation).
  - `services/`: `RagService` (busca semântica), `LLMChatService` (Ollama),
    `ChatSessionStore`, `AnalysisService` (ponte com `analysis/`),
    `LivePatientService`, `ExamPdfService`, `SignalingService` (videochamada),
    `NotificationService`, `ValkeyPublisher`, `wearables/providers` (Fitbit,
    Withings, Oura).
  - `llm/knowledge-base/`: `careplus.md` e `protocols.json` indexados pelo RAG.
  - `shared/db/`: schema e cliente Drizzle, seed do banco.
- **`mqtt-service/`:** orquestrador que conecta o broker MQTT ao Totem via Valkey pub/sub.
- **Como rodar:**
  1. Instale o [Ollama](https://ollama.com) e baixe os modelos:
     ```bash
     ollama pull llama3.2        # LLM para geração de respostas
     ollama pull nomic-embed-text  # embeddings (RAG)
     ```
  2. Instale dependências:
     ```bash
     cd server
     yarn install
     ```
  3. Copie `server/.env.example` para `server/.env` e ajuste:
     - `PORT`, `ALLOWED_ORIGINS`, `DB_PATH`
     - `OLLAMA_BASE_URL`, `OLLAMA_MODEL_LLM`, `OLLAMA_MODEL_EMBEDDINGS`
     - `MQTT_BROKER`, `VALKEY_HOST`, `VALKEY_PORT`
     - **Wearables (opcional):** `FITBIT_CLIENT_ID/SECRET`,
       `WITHINGS_CLIENT_ID/SECRET`, `OURA_CLIENT_ID/SECRET`,
       `WEARABLES_REDIRECT_BASE`, `APP_BASE_URL`. Sem credenciais, cada provedor
       cai automaticamente no modo simulado (demo offline).
  4. Suba a infra (Valkey/MQTT):
     ```bash
     docker compose up -d
     ```
  5. Crie e popule o banco:
     ```bash
     yarn db:push
     yarn db:seed
     ```
  6. Inicie a API + MQTT em modo dev:
     ```bash
     yarn dev
     ```
  7. Acesse a API em `http://localhost:3333`.

- **Outros comandos úteis:**
  - `yarn db:studio` — interface visual do banco.
  - `yarn test` / `yarn test:coverage` — testes (Vitest).
  - `yarn lint` — lint com correção automática.

- **Clientes de API/MQTT** (`server/client-config/`):
  - **Postman:** `postman.postman_collection.json`
  - **Insomnia:** `insomnia.json`
  - **MQTTX:** `mqttx.json`

### 2. `dash-client/` — Dashboards (Operadora / Médico / Paciente)

- **Tecnologia:** React 19 + TypeScript + Vite, Tailwind, Recharts.
- **Função:** três painéis sobre a mesma base de dados, cada um com sua rota:
  - **Operadora** (`/operadora`): análise preditiva de sinistros — visão geral
    com alertas e indicadores-chave, carteira completa de beneficiários (score,
    Framingham, HOMA-IR, custo projetado, exportação CSV) e aba de ROI das
    intervenções preventivas.
  - **Médico** (`/medico`): lista de pacientes por risco, agenda de consultas
    (lista/calendário, presencial ou telechamada com videochamada via WebRTC) e
    exames compartilhados pelos pacientes (com download em PDF).
  - **Paciente** (`/paciente`): status de saúde, visualização de sinais vitais,
    agendamento de consultas, histórico de exames/triagens e integrações com
    wearables (Apple Health, Fitbit, Garmin, Samsung Health, Withings, Oura —
    com OAuth2 real para Fitbit/Withings/Oura quando configurado no `server/`).
  - Conversa paciente↔médico (`/medico/conversa`, `/paciente/conversa`) e
    chamada de vídeo (`/videocall`).
  - **Tour guiado** (`src/tour/`): onboarding interativo que percorre os três
    perfis a partir da Home, definido em `tour.json`.
- **Como rodar:**
  ```bash
  cd dash-client
  yarn install
  yarn dev
  ```
  Acesse em `http://localhost:5174`. Requer a API do `server/` rodando em
  `http://localhost:3333` (configurável via `VITE_API_URL`).

### 3. `totem-client/` — Totem de Triagem

- **Tecnologia:** React 19 + TypeScript + Vite, Tailwind.
- **Função:** fluxo de atendimento do Totem — login, captura de sinais vitais,
  perguntas guiadas e resultado do score NEWS2.
- **Como rodar:**
  ```bash
  cd totem-client
  yarn install
  yarn dev
  ```
  Acesse em `http://localhost:5175`.

### 4. `docs/` — POCs e Pitches

- **`docs/POCs/langchain/`**: POC de chat RAG com LangChain, Ollama, ChromaDB e
  Redis (veja o README próprio da pasta para rodar).
- **`docs/POCs/OCR/`**: scripts Python de OCR (extração de texto em imagens).
- **`docs/pitches/`**: protótipos e roteiros das apresentações do projeto.

### `analysis/`

- Scripts Python (`compute_dashboard.py`) usados pelo `AnalysisService` do
  `server/` para gerar os dados analíticos consumidos pelo `dash-client`.

---

## Dicas

- Cada pasta (`server`, `dash-client`, `totem-client`) tem seu próprio
  `package.json` e pode ser instalada/rodada de forma independente.
- Para o fluxo completo, rode `server` primeiro, depois `dash-client` e/ou
  `totem-client`.
- Sem Ollama/Docker configurados, a API ainda sobe, mas chat com IA e wearables
  reais ficam indisponíveis (wearables caem no modo simulado).

---

## Licença

MIT
