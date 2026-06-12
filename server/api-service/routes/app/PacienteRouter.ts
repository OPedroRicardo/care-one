import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { WearableController } from '@api-service/controllers/WearableController.ts'

export default class PacienteRouter extends APIRouter {
  #wearables: WearableController

  get base_path() { return '/paciente' }

  constructor(app: Express) {
    super(app)
    this.#wearables = new WearableController(app)
  }

  setupRoutes() {
    this.router.get('/wearables',     this.#wearables.list.bind(this.#wearables))
    this.router.post('/wearables',    this.#wearables.connect.bind(this.#wearables))
    this.router.delete('/wearables',  this.#wearables.disconnect.bind(this.#wearables))
  }
}
