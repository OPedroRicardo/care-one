import { Express } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import { MedicoController } from '@api-service/controllers/MedicoController.ts'
import { PatientConversationController } from '@api-service/controllers/PatientConversationController.ts'

export default class MedicoRouter extends APIRouter {
  #controller: MedicoController
  #convController: PatientConversationController

  get base_path() { return '/medico' }

  constructor(app: Express) {
    super(app)
    this.#controller     = new MedicoController(app)
    this.#convController = new PatientConversationController(app)
  }

  setupRoutes() {
    this.router.get('/patients',               this.#controller.patients.bind(this.#controller))
    this.router.get('/agenda',                 this.#controller.agenda.bind(this.#controller))
    this.router.get('/exames',                 this.#controller.examesCompartilhados.bind(this.#controller))
    this.router.get('/conversa/:patientName',  this.#convController.getConversation.bind(this.#convController))
    this.router.post('/conversa/:patientName', this.#convController.sendMessage.bind(this.#convController))
  }
}
