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
- **Função:** Serviços para sinais vitais, autenticação e integração com Totem.
- **Subpastas:**
  - `api-service/`: Código principal da API.
    - `controllers/`: Lógica de negócio (ex: ScoreController para cálculo NEWS2).
    - `middlewares/`: Middlewares de logging, segurança, etc.
    - `routes/`: Organização modular das rotas (app, totem, score).
- **Como rodar:**
  1. Instale dependências:
     ```
     cd server
     npm install
     ```
  2. Configure variáveis no `.env` (exemplo: PORT, ALLOWED_ORIGINS).
  3. Inicie em modo desenvolvimento:
     ```
     npm run dev
     ```
  4. Acesse: `http://localhost:<PORT>`

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
   ```
   cd server
   ```
2. Instale as dependências:
   ```
   npm install
   ```
3. Configure o arquivo `.env` com as variáveis necessárias (exemplo: PORT, ALLOWED_ORIGINS).
4. Inicie o servidor:
   ```
   npm run dev
   ```
5. Acesse a API em `http://localhost:<PORT>`

---

## Dicas

- Consulte os READMEs das POCs para instruções específicas.
- Use Docker para rodar serviços de IA e banco de dados nas POCs.
- O projeto é modular: cada pasta pode ser usada e testada separadamente.

---

## Licença

MIT

---

Se quiser, posso salvar esse README diretamente no repositório. Deseja que eu crie o arquivo?