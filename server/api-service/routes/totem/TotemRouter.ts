import { Express, Request, Response, RequestHandler } from 'express'
import { APIRouter } from '@api-service/routes/api-router.ts'
import ScoreRouter from '@api-service/routes/totem/ScoreRouter.ts'
import MeasureRouter from '@api-service/routes/totem/MeasureRouter.ts'

const totemMiddleware: RequestHandler = (_req, _res, next) => next()

const hello = (_: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Funfando o totem!' })
}

export default class TotemRouter extends APIRouter {
  get base_path() { return '/totem' }

  constructor(app: Express) {
    super(app, [totemMiddleware])
    this.addChild(new ScoreRouter(app))
    this.addChild(new MeasureRouter(app))
  }

  setupRoutes() {
    this.router.get('/', hello)
  }
}
