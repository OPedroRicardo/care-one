import { ChatOllama } from "@langchain/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DocumentService } from "./Documents.service.js";

/**
 * Message interface for chat conversations
 */
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Service for handling RAG-based chat conversations
 * 
 * @class ChatService
 * @description Orchestrates chat interactions using Retrieval-Augmented Generation (RAG).
 * Validates topics, retrieves relevant documents, and generates context-aware responses.
 * 
 * @example
 * ```typescript
 * const chatService = new ChatService(
 *   documentService,
 *   ['HR Policies', 'Benefits'],
 *   'You are an HR assistant...'
 * );
 * const response = await chatService.chat(
 *   'How many vacation days?',
 *   'hr_policies',
 *   conversationHistory
 * );
 * ```
 */
export class ChatService {
  private llm: ChatOllama;
  private documentService: DocumentService;
  private allowedTopics: string[];
  private systemPrompt: string;

  /**
   * Creates a new ChatService instance
   * 
   * @constructor
   * @param {DocumentService} documentService - Service for document retrieval
   * @param {string[]} allowedTopics - List of allowed conversation topics
   * @param {string} [systemPrompt] - Custom system prompt (optional)
   * 
   * @description Initializes the chat service with Ollama LLM, document service,
   * and conversation constraints. If no system prompt is provided, generates
   * a default prompt based on allowed topics.
   */
  constructor(
    documentService: DocumentService,
    allowedTopics: string[],
    systemPrompt?: string
  ) {
    this.llm = new ChatOllama({
      model: process.env.OLLAMA_MODEL_LLM || "llama3.2",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      temperature: 0.3,
    });
    this.documentService = documentService;
    this.allowedTopics = allowedTopics;
    this.systemPrompt = systemPrompt || this.buildDefaultSystemPrompt();
  }

  /**
   * Builds default system prompt from allowed topics
   * 
   * @private
   * @returns {string} Generated system prompt
   * 
   * @description Creates a structured prompt that defines the assistant's
   * role, allowed topics, and response guidelines.
   */
  private buildDefaultSystemPrompt(): string {
    return `You are a specialized assistant that can only respond about the following topics:
${this.allowedTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

IMPORTANT RULES:
- If the question is not related to these topics, politely inform that you can only help with these subjects
- ALWAYS use information from the provided documents as context
- If there is no information in the documents, say you did not find it
- Be concise and objective
- Cite relevant excerpts when appropriate`;
  }

  /**
   * Validates if a message is within allowed topics
   * 
   * @private
   * @async
   * @param {string} message - User message to validate
   * @returns {Promise<boolean>} True if topic is allowed, false otherwise
   * 
   * @description Uses the LLM to analyze if the user's message relates
   * to any of the allowed topics. Returns true if the LLM responds with "SIM" (YES).
   */
  private async isTopicAllowed(message: string): Promise<boolean> {
    const checkPrompt = `Analyze if the following message is related to any of these topics:
${this.allowedTopics.join(', ')}

Message: "${message}"

Answer only: YES or NO`;

    const response = await this.llm.invoke(checkPrompt);
    const answer = response.content.toString().trim().toUpperCase();
    
    return answer.includes("YES") || answer.includes("SIM");
  }

  /**
   * Processes a user message with RAG and returns a response
   * 
   * @async
   * @param {string} userMessage - The user's message
   * @param {string} collectionName - Document collection to search
   * @param {Message[]} [conversationHistory=[]] - Previous conversation messages
   * @returns {Promise<string>} Generated response
   * @throws {Error} If document search or LLM invocation fails
   * 
   * @description
   * 1. Validates if message is within allowed topics
   * 2. Retrieves relevant documents from vector store
   * 3. Constructs prompt with context and history
   * 4. Generates and returns response
   * 
   * @example
   * ```typescript
   * const response = await chatService.chat(
   *   'What is the vacation policy?',
   *   'hr_policies',
   *   [
   *     { role: 'user', content: 'Hello' },
   *     { role: 'assistant', content: 'Hi! How can I help?' }
   *   ]
   * );
   * ```
   */
  async chat(
    userMessage: string,
    collectionName: string,
    conversationHistory: Message[] = []
  ): Promise<string> {
    const isAllowed = await this.isTopicAllowed(userMessage);

    if (!isAllowed) {
      return `Sorry, I can only help with questions related to: ${this.allowedTopics.join(', ')}. 

How can I help you with any of these subjects?`;
    }

    const relevantDocs = await this.documentService.searchDocuments(
      userMessage,
      collectionName,
      4
    );

    const context = relevantDocs
      .map((doc, i) => `[Document ${i + 1}]\n${doc.pageContent}`)
      .join("\n\n---\n\n");

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", this.systemPrompt],
      ["system", `DOCUMENT CONTEXT:\n${context}`],
      ...conversationHistory.map(msg => [msg.role, msg.content] as [string, string]),
      ["user", "{input}"],
    ]);

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const response = await chain.invoke({ input: userMessage });

    return response;
  }
}