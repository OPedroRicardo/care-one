import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { AppointmentController } from '@api-service/controllers/AppointmentController.ts'

export default class AppointmentRouter extends APIRouter {
  #controller: AppointmentController

  get base_path() { return '/agendamentos' }

  constructor(app: Express) {
    super(app)
    this.#controller = new AppointmentController(app)
  }

  setupRoutes() {
    this.router.get('/',              this.#controller.list.bind(this.#controller))
    this.router.post('/',             this.#controller.create.bind(this.#controller))
    this.router.put('/:id/confirm',   this.#controller.confirm.bind(this.#controller))
    this.router.put('/:id/cancel',    this.#controller.cancel.bind(this.#controller))
  }
}
