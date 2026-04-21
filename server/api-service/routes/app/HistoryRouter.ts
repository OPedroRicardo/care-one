import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { HistoryController } from '@api-service/controllers/HistoryController.ts'

export default class HistoryRouter extends APIRouter {
  #controller: HistoryController

  get base_path() { return '/history' }

  constructor(app: Express) {
    super(app)
    this.#controller = new HistoryController(app)
  }

  setupRoutes() {
    this.router.get('/',    this.#controller.list.bind(this.#controller))
    this.router.get('/:id', this.#controller.getById.bind(this.#controller))
  }
}
