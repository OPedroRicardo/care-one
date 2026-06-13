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
    this.router.post('/wearables/sync', this.#wearables.sync.bind(this.#wearables))
    // Real OAuth2 (Fitbit / Withings / Oura): consent redirect + provider callback.
    this.router.get('/wearables/:provider/connect',  this.#wearables.oauthConnect.bind(this.#wearables))
    this.router.get('/wearables/:provider/callback', this.#wearables.oauthCallback.bind(this.#wearables))
  }
}
