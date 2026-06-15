import { createClient, RedisClientType } from 'redis';

/**
 * Message interface representing a chat message
 */
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Service responsible for managing Redis operations for conversation persistence
 * 
 * @class RedisService
 * @description Handles conversation storage, retrieval, and deletion using Redis as the data store.
 * Conversations are stored with a default TTL of 1 hour.
 * 
 * @example
 * ```typescript
 * const redisService = new RedisService();
 * await redisService.connect();
 * await redisService.set('chat:123', messages, 3600);
 * ```
 */
export class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  /**
   * Creates a new RedisService instance and configures the Redis client
   * 
   * @constructor
   * @description Initializes the Redis client with connection URL from environment variables
   * or defaults to localhost:6379. Sets up error and connection event handlers.
   */
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
      this.isConnected = true;
    });
  }

  /**
   * Establishes connection to Redis server
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If connection to Redis fails
   * 
   * @example
   * ```typescript
   * await redisService.connect();
   * ```
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Closes the connection to Redis server
   * 
   * @async
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * await redisService.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * Stores conversation messages in Redis with TTL
   * 
   * @async
   * @param {string} key - The Redis key for storing the conversation
   * @param {Message[]} messages - Array of messages to store
   * @param {number} [ttl=3600] - Time-to-live in seconds (default: 1 hour)
   * @returns {Promise<void>}
   * @throws {Error} If Redis operation fails
   * 
   * @example
   * ```typescript
   * await redisService.set('chat:123', [
   *   { role: 'user', content: 'Hello' },
   *   { role: 'assistant', content: 'Hi there!' }
   * ], 3600);
   * ```
   */
  async set(
    key: string,
    messages: Message[],
    ttl: number = 3600
  ): Promise<void> {
    await this.client.setEx(key, ttl, JSON.stringify(messages));
  }

  /**
   * Retrieves conversation messages from Redis
   * 
   * @async
   * @param {string} key - The Redis key to retrieve
   * @returns {Promise<Message[] | null>} Array of messages or null if not found
   * @throws {Error} If Redis operation or JSON parsing fails
   * 
   * @example
   * ```typescript
   * const messages = await redisService.get('chat:123');
   * if (messages) {
   *   console.log('Found conversation with', messages.length, 'messages');
   * }
   * ```
   */
  async get(key: string): Promise<Message[] | null> {
    const data = await this.client.get(key);

    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Deletes a conversation from Redis
   * 
   * @async
   * @param {string} key - The Redis key to delete
   * @returns {Promise<void>}
   * @throws {Error} If Redis operation fails
   * 
   * @example
   * ```typescript
   * await redisService.delete('chat:123');
   * ```
   */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Lists all keys matching a given pattern
   * 
   * @async
   * @param {string} key - The key pattern to search for (e.g., 'chat')
   * @returns {Promise<string[]>} Array of matching keys with the prefix removed
   * @throws {Error} If Redis operation fails
   * 
   * @example
   * ```typescript
   * const chatIds = await redisService.listByKey('chat');
   * // Returns: ['123', '456', '789']
   * ```
   */
  async listByKey(key: string): Promise<string[]> {
    const keys = await this.client.keys(`${key}:*`);
    return keys.map((key: string) => key.replace(`${key}:`, ''));
  }
}