import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { OperadoraController } from '@api-service/controllers/OperadoraController.ts'

export default class OperadoraRouter extends APIRouter {
  get base_path() { return '/operadora' }

  constructor(app: Express) {
    super(app)
    const ctrl = new OperadoraController()
    this.router.get('/patients', ctrl.patients)
    this.router.get('/patients/refresh', ctrl.refresh)
    this.router.get('/patients/:id', ctrl.patient)
  }

  setupRoutes() {}
}
