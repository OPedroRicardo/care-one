import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { ChatController } from '@api-service/controllers/ChatController.ts'

export default class ChatRouter extends APIRouter {
  #controller: ChatController

  get base_path() { return '/chat' }

  constructor(app: Express) {
    super(app)
    this.#controller = new ChatController(app)
  }

  setupRoutes() {
    this.router.get('/list',          this.#controller.listChats.bind(this.#controller))
    this.router.get('/:id',           this.#controller.getChat.bind(this.#controller))
    this.router.post('/new',          this.#controller.newChat.bind(this.#controller))
    this.router.post('/delete',       this.#controller.deleteChat.bind(this.#controller))
    this.router.post('/message',        this.#controller.onMessage.bind(this.#controller))
    this.router.post('/message/stream', this.#controller.onMessageStream.bind(this.#controller))
    this.router.post('/message/delete', this.#controller.deleteMessage.bind(this.#controller))
    this.router.post('/message/cancel', this.#controller.cancelMessage.bind(this.#controller))
  }
}
