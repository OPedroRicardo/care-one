import { ChatOllama }           from '@langchain/ollama'
import { ChatPromptTemplate }   from '@langchain/core/prompts'
import { StringOutputParser }   from '@langchain/core/output_parsers'
import { RagService, SearchResult } from './RagService.ts'
import { ChatMessage }          from './ChatSessionStore.ts'

export interface ChatResponse {
  reply:   string
  sources: string[]
}

export type ChatStreamChunk =
  | { type: 'token'; value: string }
  | { type: 'done';  reply: string; sources: string[] }

const SYSTEM_PROMPT = `Você é o assistente clínico pessoal dos clientes da CarePlus, uma empresa de tecnologia em saúde.

Suas responsabilidades:
- Explicar resultados de triagem e exames de forma clara e acessível ao paciente
- Orientar sobre sinais vitais, seus valores normais e o que cada um significa
- Informar sobre condutas clínicas e próximos passos conforme o resultado da triagem
- Esclarecer termos médicos em linguagem simples

FORMATAÇÃO — OBRIGATÓRIO:
- Use Markdown em todas as respostas
- Prefira **tabelas** para comparar valores de exames, sinais vitais ou referências normais
- Use **negrito** para destacar valores críticos ou termos-chave
- Use listas com marcadores para enumerar orientações ou sintomas
- Use cabeçalhos (##) apenas quando a resposta tiver múltiplas seções distintas
- Nunca use blocos de código para informações clínicas
- Seja conciso: prefira tabelas e listas a parágrafos longos

REGRAS IMPORTANTES:
- Priorize os DADOS CLÍNICOS DO PACIENTE fornecidos quando eles forem relevantes para a pergunta
- Complemente com os documentos de contexto para explicações clínicas gerais
- Se a informação não estiver nos dados do paciente nem nos documentos, diga que não encontrou essa informação no sistema
- Nunca faça diagnósticos ou prescrições médicas
- Em situações de emergência (risco alto), sempre instrua o paciente a procurar atendimento imediato
- Seja objetivo, empático e use linguagem acessível ao público geral
- Responda sempre em Português do Brasil a menos que o paciente solicite que fale em outro idioma`

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

  // Retrieves RAG docs and assembles the ChatPromptTemplate for both code paths
  async #buildPrompt(
    userMessage:    string,
    history:        ChatMessage[],
    patientContext: string,
  ) {
    const docs    = await this.rag.search(userMessage, 4)
    const sources = [...new Set(docs.map(d => d.source))]
    const ragCtx  = this.#buildRagContext(docs)

    // LangChain templates interpret { } as variables — escape literal braces in data
    const safeRag     = ragCtx.replace(/\{/g, '{{').replace(/\}/g, '}}')
    const safePatient = patientContext.replace(/\{/g, '{{').replace(/\}/g, '}}')

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      ['system', `DADOS CLÍNICOS DO PACIENTE:\n\n${safePatient}`],
      ['system', `CONTEXTO DOS DOCUMENTOS (base de conhecimento):\n\n${safeRag}`],
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

  #buildRagContext(docs: SearchResult[]): string {
    if (docs.length === 0) return 'Nenhum documento relevante encontrado.'
    return docs
      .map((doc, i) => `[Documento ${i + 1} — ${doc.source}]\n${doc.content}`)
      .join('\n\n---\n\n')
  }
}
