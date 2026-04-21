// Executado antes de cada arquivo de teste (vitest setupFiles).
// Define variáveis de ambiente antes que qualquer módulo seja importado.
process.env.DB_PATH = ':memory:'
process.env.PORT = '0'
process.env.ALLOWED_ORIGINS = '*'
process.env.NODE_ENV = 'test'
