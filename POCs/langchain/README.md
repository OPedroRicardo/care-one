# RAG Chat API

A production-ready RESTful API for document-based conversational AI using Retrieval-Augmented Generation (RAG). Built with LangChain, Ollama, ChromaDB, and Redis.

## Features

- **Document Processing**: Upload and index PDF documents for semantic search
- **RAG-Based Chat**: Context-aware responses using retrieved document chunks
- **Topic Validation**: Restricts conversations to predefined topics
- **Conversation Persistence**: Redis-backed chat history with TTL
- **Local LLMs**: Runs entirely offline using Ollama models
- **Vector Search**: ChromaDB for efficient similarity search
- **Type-Safe**: Full TypeScript implementation with comprehensive JSDoc

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│          Express API                │
│  ┌──────────────┐  ┌─────────────┐ │
│  │   Routes     │  │ Middlewares │ │
│  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────┘
       │                    │
       ▼                    ▼
┌─────────────┐      ┌─────────────┐
│   Services  │      │    Redis    │
│             │      │ (Chat Store)│
│ • Chat      │      └─────────────┘
│ • Documents │
│ • Redis     │
└─────────────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│   Ollama    │ │  ChromaDB   │
│   (LLM)     │ │  (Vectors)  │
└─────────────┘ └─────────────┘
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **AI/ML**: LangChain, Ollama
- **Databases**: ChromaDB (vectors), Redis (cache)
- **Tools**: Docker, Yarn

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Yarn package manager

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd langchain_lab
yarn install
```

### 2. Environment Setup

Create a `.env` file:

```env
# API Configuration
PORT=3000
NODE_ENV=development

# ChromaDB
CHROMA_URL=http://localhost:8000

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_LLM=llama3.2
OLLAMA_MODEL_EMBEDDINGS=nomic-embed-text

# Redis
REDIS_URL=redis://localhost:6379
```

### 3. Start Infrastructure

```bash
# Start ChromaDB, Ollama, and Redis
docker-compose up -d

# Download Ollama models
docker exec ollama ollama pull llama3.2
docker exec ollama ollama pull nomic-embed-text

# Verify services
docker ps
```

### 4. Run API

```bash
# Development mode with hot-reload
yarn dev

# Production build
yarn build
yarn start
```

The API will be available at `http://localhost:3000`

## API Reference

### Health Check

**GET** `/`

Check if the API is running.

**Response:**
```json
{
  "message": "AI Server is running!"
}
```

### Upload Document

**POST** `/documents/upload`

Upload and index a PDF document.

**Request:**
- `Content-Type: multipart/form-data`
- Body:
  - `file` (required): PDF file
  - `collectionName` (required): Collection identifier

**Response:**
```json
{
  "message": "Documento indexado com sucesso",
  "collectionName": "hr_policies",
  "filename": "employee_handbook.pdf"
}
```

### List Collections

**GET** `/documents/collections`

List all available document collections.

**Response:**
```json
{
  "collections": ["hr_policies", "company_procedures"]
}
```

### Send Message

**POST** `/chat/message`

Send a message and receive an AI-generated response.

**Request:**
```json
{
  "message": "How many vacation days do I have?",
  "collectionName": "hr_policies",
  "chatId": "chat_1234567890" // optional
}
```

**Response:**
```json
{
  "response": "According to the employee handbook...",
  "chatId": "chat_1234567890"
}
```

### Get Conversation

**GET** `/chat/:id`

Retrieve conversation history.

**Response:**
```json
{
  "chatId": "chat_1234567890",
  "messages": [
    {
      "role": "user",
      "content": "How many vacation days?"
    },
    {
      "role": "assistant",
      "content": "You have 30 days..."
    }
  ]
}
```

### Delete Conversation

**DELETE** `/chat/:id`

Delete conversation history.

**Response:**
```json
{
  "message": "Conversa deletada"
}
```

## Project Structure

```
langchain_lab/
├── src/
│   ├── services/
│   │   ├── Chat.service.ts        # RAG orchestration
│   │   ├── Documents.service.ts   # PDF processing & search
│   │   └── Redis.service.ts       # Conversation persistence
│   ├── middlewares/
│   │   ├── Chat.middleware.ts     # Chat endpoint handlers
│   │   └── Document.middleware.ts # Upload endpoint handlers
│   ├── routes/
│   │   ├── Chat.routes.ts         # Chat route definitions
│   │   ├── Documents.routes.ts    # Document route definitions
│   │   └── index.ts               # Route aggregator
│   ├── APIService.ts              # Express app setup
│   └── index.ts                   # Application entry point
├── docker-compose.yml             # Infrastructure setup
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── .env                           # Environment variables
```

## Configuration

### Allowed Topics

Edit `Chat.middleware.ts` to customize allowed conversation topics:

```typescript
const allowedTopics = [
  "HR Policies",
  "Internal Procedures",
  "Corporate Benefits",
  "Labor Regulations"
];
```

### System Prompt

Customize the AI assistant's behavior in `Chat.middleware.ts`:

```typescript
const systemPrompt = `You are an HR assistant...`;
```

### Chunking Parameters

Adjust document splitting in `Documents.service.ts`:

```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,      // Characters per chunk
  chunkOverlap: 200,    // Overlap between chunks
});
```

### Redis TTL

Change conversation expiration time in `Chat.middleware.ts`:

```typescript
await this.redisService.set(key, history, 7200); // 2 hours
```

## Testing

### Using Postman

Import the collection from the artifacts section (see development documentation).

### Using cURL

```bash
# Upload document
curl -X POST http://localhost:3000/documents/upload \
  -F "file=@employee_handbook.pdf" \
  -F "collectionName=hr_policies"

# Send message
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How many vacation days?",
    "collectionName": "hr_policies"
  }'
```

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f chromadb
docker-compose logs -f ollama
docker-compose logs -f redis
```

### Redis CLI

```bash
# Connect to Redis
docker exec -it redis redis-cli

# Commands
KEYS *                        # List all keys
GET chat:chat_123456          # Get conversation
TTL chat:chat_123456          # Check expiration
DEL chat:chat_123456          # Delete conversation
```

### ChromaDB API

```bash
# List collections
curl http://localhost:8000/api/v1/collections

# Get collection info
curl http://localhost:8000/api/v1/collections/hr_policies
```

## Troubleshooting

### Docker Issues

```bash
# Restart all services
docker-compose restart

# Rebuild containers
docker-compose up -d --build

# Clean everything
docker-compose down -v
```

### Ollama Model Issues

```bash
# List installed models
docker exec ollama ollama list

# Re-download model
docker exec ollama ollama pull llama3.2

# Test model
docker exec ollama ollama run llama3.2 "Hello"
```

### Redis Connection Issues

```bash
# Check Redis is running
docker exec redis redis-cli ping

# View Redis logs
docker logs redis
```

## Performance Optimization

### ChromaDB

- Use persistent volumes for faster restarts
- Index documents in batches for large datasets
- Adjust `k` parameter in search based on needs

### Redis

- Increase TTL for frequently accessed conversations
- Use Redis Cluster for high availability
- Monitor memory usage with `INFO memory`

### Ollama

- Use GPU acceleration for faster inference
- Choose smaller models for lower latency
- Adjust temperature for response consistency

## Security Considerations

1. **API Authentication**: Add JWT or API key authentication
2. **Rate Limiting**: Implement request throttling
3. **Input Validation**: Already using Zod schemas
4. **File Upload**: Validate file types and sizes
5. **CORS**: Configure allowed origins in production

## Production Deployment

### Environment Variables

```env
NODE_ENV=production
PORT=3000
CHROMA_URL=https://chroma.production.com
OLLAMA_BASE_URL=https://ollama.production.com
REDIS_URL=redis://redis.production.com:6379
```

### Docker Compose Production

```yaml
services:
  api:
    image: your-registry/rag-chat-api:latest
    environment:
      - NODE_ENV=production
    restart: always
    depends_on:
      - chromadb
      - ollama
      - redis
```

### Health Checks

Implement proper health check endpoints for:
- ChromaDB connectivity
- Ollama model availability
- Redis connection status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper JSDoc comments
4. Test thoroughly
5. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue on the repository.