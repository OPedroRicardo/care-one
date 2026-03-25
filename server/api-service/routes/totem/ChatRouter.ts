import { ChatController } from '../../controllers/ChatController';

import { Express, Request, Response, RequestHandler } from 'express';
import { APIRouter } from '../router';

// Exemplo de middleware próprio do Chat
const chatMiddleware: RequestHandler = (req, res, next) => {
  // Pode adicionar lógica específica do Chat
  // console.log('Chat middleware');
  next();
};

export default class ChatRouter extends APIRouter {
  chatController

  get base_path() { return '/chat'; }

  constructor(app: Express) {
    super(app, [chatMiddleware]);

    this.chatController = new ChatController(app)
  }

  setupRoutes() {
    this.router.get('/list', this.chatController.listChats.bind(this.chatController))
    this.router.get('/:id',  this.chatController.getChat.bind(this.chatController))
    this.router.post('/new',            this.chatController.newChat.bind(this.chatController))
    this.router.post('/delete',         this.chatController.deleteChat.bind(this.chatController))
    this.router.post('/message',        this.chatController.onMessage.bind(this.chatController))
    this.router.post('/message/delete', this.chatController.deleteMessage.bind(this.chatController))
    this.router.post('/message/cancel', this.chatController.cancelMessage.bind(this.chatController))
  }
}