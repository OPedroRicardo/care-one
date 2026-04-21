import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { MeasureController } from '@api-service/controllers/MeasureController.ts'

export default class MeasureRouter extends APIRouter {
  #controller: MeasureController

  get base_path() { return '/measure' }

  constructor(app: Express) {
    super(app)
    this.#controller = new MeasureController(app)
  }

  setupRoutes() {
    this.router.post('/', this.#controller.measure.bind(this.#controller))
  }
}
