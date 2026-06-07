import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { ExamController } from '@api-service/controllers/ExamController.ts'

export default class ExamRouter extends APIRouter {
  #controller: ExamController

  get base_path() { return '/exames' }

  constructor(app: Express) {
    super(app)
    this.#controller = new ExamController(app)
  }

  setupRoutes() {
    this.router.get('/',             this.#controller.list.bind(this.#controller))
    this.router.get('/compartilhados', this.#controller.listShared.bind(this.#controller))
    this.router.post('/upload',      this.#controller.upload.bind(this.#controller))
    this.router.post('/:id/share',   this.#controller.share.bind(this.#controller))
    this.router.delete('/:id/share', this.#controller.unshare.bind(this.#controller))
  }
}
