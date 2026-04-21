import { ChatOllama }           from '@langchain/ollama'
import { ChatPromptTemplate }   from '@langchain/core/prompts'
import { StringOutputParser }   from '@langchain/core/output_parsers'
import { RagService, SearchResult } from './RagService.ts'
import { ChatMessage }          from './ChatSessionStore.ts'

export interface ChatResponse {
  reply:   string
  sources: string[]
}

const SYSTEM_PROMPT = `Você é o assistente clínico pessoal dos clientes da CarePlus, uma empresa de tecnologia em saúde.

Suas responsabilidades:
- Explicar resultados de triagem e exames de forma clara e acessível ao paciente
- Orientar sobre sinais vitais, seus valores normais e o que cada um significa
- Informar sobre condutas clínicas e próximos passos conforme o resultado da triagem
- Esclarecer termos médicos em linguagem simples

REGRAS IMPORTANTES:
- Baseie suas respostas EXCLUSIVAMENTE nos documentos de contexto fornecidos
- Se a informação não estiver nos documentos, diga que não encontrou essa informação no sistema
- Nunca faça diagnósticos ou prescrições médicas
- Em situações de emergência (risco alto), sempre instrua o paciente a procurar atendimento imediato
- Seja objetivo, empático e use linguagem acessível ao público geral
- Responda sempre em Português do Brasil a menos que o paciente solicite que fale em outro idioma`

/**
 * Orquestra a chamada ao LLM (Ollama) com contexto RAG.
 * Recebe a mensagem do usuário, recupera documentos relevantes e gera resposta.
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
   * Gera uma resposta com RAG para a mensagem do usuário.
   *
   * @param userMessage - Mensagem enviada pelo usuário
   * @param history     - Histórico da conversa (sem a mensagem atual)
   * @param signal      - AbortSignal opcional para cancelamento
   */
  async chat(
    userMessage: string,
    history:     ChatMessage[],
    signal?:     AbortSignal,
  ): Promise<ChatResponse> {
    // 1. Recupera documentos relevantes da knowledge-base
    const docs    = await this.rag.search(userMessage, 4)
    const context = this.#buildContext(docs)
    const sources = [...new Set(docs.map(d => d.source))]

    // 2. Monta o prompt com system, contexto RAG, histórico e mensagem atual
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      ['system', `CONTEXTO DOS DOCUMENTOS:\n\n${context}`],
      ...this.#formatHistory(history),
      ['human', '{input}'],
    ])

    // 3. Encadeia prompt → LLM → parser
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())

    const reply = await chain.invoke(
      { input: userMessage },
      { signal },
    )

    return { reply, sources }
  }

  // Formata o histórico da sessão para o ChatPromptTemplate
  #formatHistory(history: ChatMessage[]): [string, string][] {
    return history.map(msg => [
      msg.role === 'user' ? 'human' : 'assistant',
      msg.content,
    ])
  }

  // Formata os documentos recuperados em bloco de contexto legível
  #buildContext(docs: SearchResult[]): string {
    if (docs.length === 0) return 'Nenhum documento relevante encontrado.'

    return docs
      .map((doc, i) => `[Documento ${i + 1} — ${doc.source}]\n${doc.content}`)
      .join('\n\n---\n\n')
  }
}
