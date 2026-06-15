import { z } from "zod";
import { ChatService } from "../services/Chat.service.js";
import { DocumentService } from "../services/Documents.service.js";
import { RedisService } from "../services/Redis.service.js";
import { Request, Response } from "express";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const chatSchema = z.object({
  message: z.string().min(1),
  collectionName: z.string(),
  chatId: z.string().optional(),
});

export class ChatMiddleware {
  private redisService: RedisService;
  private chatService: ChatService;

  constructor() {
    const allowedToppics = [
      "Políticas de RH da empresa",
      "Procedimentos internos",
      "Benefícios corporativos",
      "Regulamentos trabalhistas"
    ];
    this.chatService = new ChatService(
      new DocumentService(),
      allowedToppics,
      `Você é o assistente de RH da empresa. Ajude os funcionários com dúvidas sobre:
${allowedToppics.map(toppic => `- ${toppic}\n`)}.
Seja sempre profissional, claro e cite as fontes quando possível.`
    );

    // Inicializar Redis
    this.redisService = new RedisService();
    this.redisService.connect().catch(err => {
      console.error('Erro ao conectar Redis:', err);
    });
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const { message, collectionName, chatId } = chatSchema.parse(req.body);

      const convId = chatId || `chat_${Date.now()}`;
      const key = `chat:${convId}`

      // Recuperar histórico do Redis
      const history = await this.redisService.get(key) || [];

      // Processar mensagem
      const response = await this.chatService.chat(message, collectionName, history);

      // Atualizar histórico
      const userMessage: Message = { role: "user", content: message };
      const assistantMessage: Message = { role: "assistant", content: response };

      history.push(userMessage, assistantMessage);

      // Salvar no Redis (TTL: 1 hora)
      await this.redisService.set(key, history, 3600);

      res.json({
        response,
        chatId: convId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      console.error("Erro no chat:", error);
      res.status(500).json({ 
        error: "Erro ao processar mensagem",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async getChat(req: Request, res: Response) {
    try {
      const { id } = req.params
      const key = `chat:${id}`
      const history = await this.redisService.get(key);

      if (!history) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      res.json({ chatId: id, messages: history });
    } catch (error) {
      console.error("Erro ao buscar conversa:", error);
      res.status(500).json({ error: "Erro ao buscar conversa" });
    }
  }

  async deleteChat(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await this.redisService.delete(`chat:${id}`);

      res.json({ message: "Conversa deletada" });
    } catch (error) {
      console.error("Erro ao deletar conversa:", error);
      res.status(500).json({ error: "Erro ao deletar conversa" });
    }
  }
}