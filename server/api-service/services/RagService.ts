import { OllamaEmbeddings } from '@langchain/ollama'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Document } from '@langchain/core/documents'
import { readFileSync, readdirSync } from 'fs'
import { join, extname, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const DEFAULT_KB_PATH = join(__dirname, '..', 'knowledge-base')

export interface SearchResult {
  content: string
  source: string
}

interface IndexedDoc {
  doc: Document
  embedding: number[]
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

/**
 * Carrega arquivos .md e .json da knowledge-base, gera embeddings via Ollama
 * e os indexa em memória para busca semântica por similaridade de cosseno.
 */
export class RagService {
  private index: IndexedDoc[] = []
  private embeddings: OllamaEmbeddings
  private kbPath: string
  private ready: Promise<void>

  constructor(kbPath: string = DEFAULT_KB_PATH) {
    this.kbPath = kbPath
    this.embeddings = new OllamaEmbeddings({
      model:   process.env.OLLAMA_MODEL_EMBEDDINGS ?? 'all-minilm',
      baseUrl: process.env.OLLAMA_BASE_URL         ?? 'http://localhost:11434',
    })
    this.ready = this.#init()
  }

  // Inicialização assíncrona: carrega, split e indexa todos os documentos
  async #init() {
    const docs   = this.#loadDocuments()
    const splits = await this.#splitDocuments(docs)

    const embeddings = await this.embeddings.embedDocuments(splits.map(d => d.pageContent))
    this.index = splits.map((doc, i) => ({ doc, embedding: embeddings[i] }))
    console.log(`[RAG] Indexados ${splits.length} chunks de ${docs.length} arquivos em "${this.kbPath}"`)
  }

  // Lê todos os .md e .json da pasta e converte em Documents do LangChain
  #loadDocuments(): Document[] {
    const files = readdirSync(this.kbPath)
    const docs: Document[] = []

    for (const file of files) {
      const filePath = join(this.kbPath, file)
      const source   = basename(file)
      const ext      = extname(file)

      if (ext === '.md') {
        const content = readFileSync(filePath, 'utf-8')
        docs.push(new Document({ pageContent: content, metadata: { source, type: 'markdown' } }))
        continue
      }

      if (ext === '.json') {
        const raw  = readFileSync(filePath, 'utf-8')
        const data = JSON.parse(raw)
        // Serializa o JSON com identação para preservar estrutura legível pelo LLM
        const content = JSON.stringify(data, null, 2)
        docs.push(new Document({ pageContent: content, metadata: { source, type: 'json' } }))
      }
    }

    return docs
  }

  // Divide documentos em chunks com overlap para melhor recuperação
  async #splitDocuments(docs: Document[]): Promise<Document[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize:    256,
      chunkOverlap: 32,
      separators:   ['\n## ', '\n### ', '\n\n', '\n', ' '],
    })
    return splitter.splitDocuments(docs)
  }

  // Aguarda inicialização e realiza busca semântica por similaridade de cosseno
  async search(query: string, k = 4): Promise<SearchResult[]> {
    await this.ready

    const queryEmbedding = await this.embeddings.embedQuery(query)

    const scored = this.index.map(({ doc, embedding }) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, embedding),
    }))

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, k).map(({ doc }) => ({
      content: doc.pageContent,
      source:  (doc.metadata.source as string) ?? 'desconhecido',
    }))
  }

  // Reindexar manualmente (útil se os arquivos mudarem em runtime)
  async reindex() {
    this.ready = this.#init()
    await this.ready
  }
}
