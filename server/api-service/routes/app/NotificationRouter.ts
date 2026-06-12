import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { NotificationController } from '@api-service/controllers/NotificationController.ts'

export default class NotificationRouter extends APIRouter {
  #controller: NotificationController

  get base_path() { return '/notifications' }

  constructor(app: Express) {
    super(app)
    this.#controller = new NotificationController(app)
  }

  setupRoutes() {
    this.router.get('/',            this.#controller.list.bind(this.#controller))
    this.router.put('/read-all',    this.#controller.markAllRead.bind(this.#controller))
    this.router.put('/:id/read',    this.#controller.markRead.bind(this.#controller))
  }
}
