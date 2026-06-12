import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { PatientController } from '@api-service/controllers/PatientController.ts'

export default class PatientRouter extends APIRouter {
  #controller: PatientController

  get base_path() { return '/patients' }

  constructor(app: Express) {
    super(app)
    this.#controller = new PatientController(app)
  }

  setupRoutes() {
    this.router.get('/:name', this.#controller.getByName.bind(this.#controller))
  }
}
