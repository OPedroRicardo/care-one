import { ChatOllama }           from '@langchain/ollama'
import { ChatPromptTemplate }   from '@langchain/core/prompts'
import { StringOutputParser }   from '@langchain/core/output_parsers'
import { RagService, SearchResult } from './RagService.ts'
import { ChatMessage }          from './ChatSessionStore.ts'
import { SYSTEM_PROMPT }        from '../llm/prompts.ts'

export interface ChatResponse {
  reply:   string
  sources: string[]
}

export type ChatStreamChunk =
  | { type: 'token'; value: string }
  | { type: 'done';  reply: string; sources: string[] }

/**
 * Orquestra a chamada ao LLM (Ollama) com contexto RAG e dados clínicos do paciente.
 */
export class LLMChatService {
  private llm: ChatOllama
  private rag: RagService

  constructor(rag: RagService) {
    this.rag = rag
    this.llm = new ChatOllama({
      model:       process.env.OLLAMA_MODEL_LLM ?? 'llama3.2',
      baseUrl:     process.env.OLLAMA_BASE_URL  ?? 'http://localhost:11434',
      temperature: 0.3,
    })
  }

  /**
   * Gera uma resposta com RAG para a mensagem do usuário (streaming).
   * Yields { type:'token', value } por cada fragmento e, ao terminar,
   * yields { type:'done', reply, sources } com o texto completo.
   */
  async *chatStream(
    userMessage:    string,
    history:        ChatMessage[],
    patientContext: string,
    signal?:        AbortSignal,
  ): AsyncGenerator<ChatStreamChunk> {
    const { prompt, sources } = await this.#buildPrompt(userMessage, history, patientContext)
    const chain  = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const stream = await chain.stream({ input: userMessage }, { signal })

    let reply = ''
    for await (const chunk of stream) {
      reply += chunk
      yield { type: 'token', value: chunk }
    }

    yield { type: 'done', reply, sources }
  }

  /**
   * Gera uma resposta com RAG para a mensagem do usuário (não-streaming).
   */
  async chat(
    userMessage:    string,
    history:        ChatMessage[],
    patientContext: string,
    signal?:        AbortSignal,
  ): Promise<ChatResponse> {
    const { prompt, sources } = await this.#buildPrompt(userMessage, history, patientContext)
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const reply = await chain.invoke({ input: userMessage }, { signal })
    return { reply, sources }
  }

  // Retrieves RAG docs and assembles a single consolidated ChatPromptTemplate
  async #buildPrompt(
    userMessage:    string,
    history:        ChatMessage[],
    patientContext: string,
  ) {
    // k=5 with a minimum relevance threshold to suppress unrelated chunks
    const docs    = await this.rag.search(userMessage, 5, 0.20)
    const sources = [...new Set(docs.map(d => d.source))]

    const systemMessage = [
      SYSTEM_PROMPT,
      `## DADOS CLÍNICOS DO PACIENTE\n\n${patientContext}`,
      this.#buildRagSection(docs),
    ].join('\n\n---\n\n')

    // LangChain templates interpret { } as variables — escape literal braces in injected data
    const safeSystem = systemMessage.replace(/\{/g, '{{').replace(/\}/g, '}}')

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', safeSystem],
      ...this.#formatHistory(history),
      ['human', '{input}'],
    ])

    return { prompt, sources }
  }

  #formatHistory(history: ChatMessage[]): [string, string][] {
    return history.map(msg => [
      msg.role === 'user' ? 'human' : 'assistant',
      msg.content,
    ])
  }

  #buildRagSection(docs: SearchResult[]): string {
    if (docs.length === 0) {
      return '## BASE DE CONHECIMENTO\n\nNenhum documento relevante encontrado para esta consulta.'
    }
    const items = docs.map((doc, i) => {
      const relevance = Math.round(doc.score * 100)
      return `[Trecho ${i + 1} — ${doc.source} | Relevância: ${relevance}%]\n${doc.content}`
    })
    return `## BASE DE CONHECIMENTO\n\n${items.join('\n\n---\n\n')}`
  }
}
