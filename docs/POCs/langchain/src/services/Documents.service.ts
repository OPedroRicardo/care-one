import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "langchain";
import { OllamaEmbeddings } from "@langchain/ollama";

/**
 * Service for managing document indexing and retrieval operations
 * 
 * @class DocumentService
 * @description Handles PDF document processing, text chunking, embedding generation,
 * and vector storage using ChromaDB for semantic search capabilities.
 * 
 * @example
 * ```typescript
 * const docService = new DocumentService();
 * await docService.indexDocument(pdfBuffer, 'hr_policies');
 * const results = await docService.searchDocuments('vacation policy', 'hr_policies');
 * ```
 */
export class DocumentService {
  private embeddings: OllamaEmbeddings;
  private chromaUrl: string;

  /**
   * Creates a new DocumentService instance
   * 
   * @constructor
   * @param {string} [chromaUrl] - ChromaDB server URL (defaults to env var or localhost:8000)
   * @description Initializes the service with Ollama embeddings model and ChromaDB connection
   */
  constructor(
    chromaUrl: string = process.env.CHROMA_URL || "http://localhost:8000"
  ) {
    this.embeddings = new OllamaEmbeddings({
      model: process.env.OLLAMA_MODEL_EMBEDDINGS || "nomic-embed-text",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    });
    this.chromaUrl = chromaUrl;
  }

  /**
   * Processes and indexes a PDF document into ChromaDB
   * 
   * @async
   * @param {string | Blob | Buffer} file - The PDF file to process (path, Blob, or Buffer)
   * @param {string} collectionName - Name of the ChromaDB collection to store the document
   * @returns {Promise<void>}
   * @throws {Error} If PDF loading, processing, or indexing fails
   * 
   * @description
   * 1. Converts Buffer to Blob if necessary
   * 2. Loads and extracts text from PDF
   * 3. Splits text into chunks (1000 chars, 200 overlap)
   * 4. Generates embeddings and stores in ChromaDB
   * 
   * @example
   * ```typescript
   * await documentService.indexDocument(
   *   pdfBuffer,
   *   'company_policies'
   * );
   * // Output: Document indexed: company_policies (45 chunks)
   * ```
   */
  async indexDocument(
    file: string | Blob | Buffer,
    collectionName: string,
  ): Promise<void> {
    let fileToLoad: string | Blob;

    if (Buffer.isBuffer(file)) {
      const uint8Array = new Uint8Array(file);
      fileToLoad = new Blob([uint8Array], { type: 'application/pdf' });
    } else {
      fileToLoad = file;
    }

    const loader = new PDFLoader(fileToLoad);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const texts = docs.map(d => d.pageContent);
    const textSplits = await splitter.createDocuments(texts);

    await Chroma.fromDocuments(textSplits, this.embeddings, {
      collectionName,
      url: this.chromaUrl,
    });

    console.log(`Document indexed: ${collectionName} (${textSplits.length} chunks)`);
  }

  /**
   * Performs semantic search on indexed documents
   * 
   * @async
   * @param {string} query - The search query
   * @param {string} collectionName - Name of the ChromaDB collection to search
   * @param {number} [k=4] - Number of results to return
   * @returns {Promise<Document[]>} Array of relevant document chunks
   * @throws {Error} If collection doesn't exist or search fails
   * 
   * @description Uses vector similarity search to find the most relevant
   * document chunks based on semantic meaning rather than keyword matching.
   * 
   * @example
   * ```typescript
   * const results = await documentService.searchDocuments(
   *   'How many vacation days?',
   *   'hr_policies',
   *   4
   * );
   * console.log(`Found ${results.length} relevant chunks`);
   * ```
   */
  async searchDocuments(
    query: string,
    collectionName: string,
    k: number = 4
  ): Promise<Document[]> {
    const vectorStore = await Chroma.fromExistingCollection(this.embeddings, {
      collectionName,
      url: this.chromaUrl,
    });

    const results = await vectorStore.similaritySearch(query, k);
    return results;
  }

  /**
   * Lists all available document collections
   * 
   * @async
   * @returns {Promise<string[]>} Array of collection names
   * @todo Implement ChromaDB API call to retrieve collections
   * 
   * @example
   * ```typescript
   * const collections = await documentService.listCollections();
   * console.log('Available collections:', collections);
   * ```
   */
  async listCollections(): Promise<string[]> {
    return [];
  }
}