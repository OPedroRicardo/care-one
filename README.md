# CarePlus Next

Projeto acadêmico para FIAP, integrando soluções de saúde, IA e interfaces modernas. O repositório contém múltiplos módulos: backend, POCs de IA, interface Totem e pitches.

## Estrutura do Projeto

```
careplus-next/
├── server/        # Backend Express/TypeScript
├── POCs/          # Provas de conceito (IA, OCR, LangChain)
├── pitches/       # Apresentações e protótipos
├── totem-client/  # Frontend React/Vite
```

### 1. `server/` — Backend Principal

- **Tecnologia:** Express + TypeScript
- **Função:** Serviços para sinais vitais, chat clínico com RAG + LLM e integração com Totem.
- **Subpastas:**
  - `api-service/`: Código principal da API.
    - `controllers/`: Lógica de negócio (ScoreController, ChatController).
    - `middlewares/`: Middlewares de logging, segurança, etc.
    - `routes/`: Organização modular das rotas (app, totem, score, chat).
    - `services/`: RagService (busca semântica), LLMChatService (Ollama), ChatSessionStore (DB).
    - `db/`: Schema e cliente Drizzle ORM (SQLite via libsql).
    - `knowledge-base/`: Documentos `.md`/`.json` indexados pelo RAG.
- **Como rodar:**
  1. Instale o [Ollama](https://ollama.com) e baixe os modelos necessários:
     ```bash
     ollama pull llama3.2        # LLM para geração de respostas
     ollama pull all-minilm      # modelo de embeddings (RAG)
     ```
  2. Instale dependências:
     ```bash
     cd server
     yarn install
     ```
  3. Configure variáveis no `.env` (copie de `.env.example`):
     ```
     OLLAMA_BASE_URL="http://localhost:11434"
     OLLAMA_MODEL_LLM="llama3.2"
     OLLAMA_MODEL_EMBEDDINGS="all-minilm"
     DB_PATH="file:./careplus.db"
     ```
  4. Crie o banco de dados:
     ```bash
     yarn db:push
     ```
  5. Inicie em modo desenvolvimento:
     ```bash
     yarn dev
     ```
  6. Acesse: `http://localhost:3333`
- **Scripts úteis:**
  - `yarn db:push` — cria/atualiza o schema SQLite
  - `yarn db:studio` — abre o Drizzle Studio (UI para o banco)
- **Postman:** importe `careplus.postman_collection.json` na raiz do `server/`.

### 2. `POCs/` — Provas de Conceito

- **langchain/**: API de chat RAG (Retrieval-Augmented Generation) com LangChain, Ollama, ChromaDB e Redis.
  - **Como rodar:**
    1. Instale dependências:
       ```
       cd POCs/langchain
       yarn install
       ```
    2. Configure `.env` conforme exemplo do README.
    3. Suba infraestrutura:
       ```
       docker-compose up -d
       ```
    4. Baixe modelos Ollama:
       ```
       docker exec ollama ollama pull llama3.2
       docker exec ollama ollama pull nomic-embed-text
       ```
    5. Rode a API:
       ```
       yarn dev
       ```
    6. Acesse: `http://localhost:3000`
  - **Endpoints:** Upload de documentos, chat, histórico, coleções, etc.
  - **Referência completa:** Veja o README em `POCs/langchain/README.md`.

- **OCR/**: Scripts Python para reconhecimento de texto em imagens.
  - `img_map.py`, `txt_recognition.py`: Processamento de imagens e extração de texto.
  - `assets/`: Dados de teste.

### 3. `totem-client/` — Frontend React

- **Tecnologia:** React, TypeScript, Vite.
- **Função:** Interface para o Totem de atendimento, com páginas de login, vitais, perguntas, resultados.
- **Como rodar:**
  1. Instale dependências:
     ```
     cd totem-client
     npm install
     ```
  2. Rode em modo desenvolvimento:
     ```
     npm run dev
     ```
  3. Acesse: `http://localhost:5173`

### 4. `pitches/` — Apresentações

- Protótipos HTML/CSS/JS para demonstração de ideias e funcionalidades.
- Cada pitch tem um README e arquivos de apresentação.

---

## Como Rodar o Server Principal

1. Entre na pasta `server`:
   ```bash
   cd server
   ```
2. Instale o Ollama e puxe os modelos:
   ```bash
   ollama pull llama3.2
   ollama pull all-minilm
   ```
3. Instale as dependências:
   ```bash
   yarn install
   ```
4. Configure o `.env` a partir do `.env.example`.
5. Crie o banco de dados:
   ```bash
   yarn db:push
   ```
6. Inicie o servidor:
   ```bash
   yarn dev
   ```
7. Acesse a API em `http://localhost:3333`

---

## Dicas

- Consulte os READMEs das POCs para instruções específicas.
- Use Docker para rodar serviços de IA e banco de dados nas POCs.
- O projeto é modular: cada pasta pode ser usada e testada separadamente.

---

## Licença

MIT

---

