# 1. Subir todos os containers
docker-compose up -d

# 2. Baixar modelos do Ollama
docker exec ollama ollama pull llama3.2
docker exec ollama ollama pull nomic-embed-text

# 3. Verificar se tudo está rodando
docker ps

# 4. Testar Redis
docker exec redis redis-cli ping
# Deve retornar: PONG

# 5. Rodar API
yarn dev