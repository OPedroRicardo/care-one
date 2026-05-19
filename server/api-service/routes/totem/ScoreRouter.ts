import { ScoreController } from '@api-service/controllers/ScoreController.ts';

import { Express, Request, Response, RequestHandler } from 'express';
import { APIRouter } from '@api-service/routes/router.ts';

// Exemplo de middleware próprio do Score
const scoreMiddleware: RequestHandler = (req, res, next) => {
  // Pode adicionar lógica específica do Score
  // console.log('Score middleware');
  next();
};

const hello = (_: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Funfando o score!' });
};

export default class ScoreRouter extends APIRouter {
  scoreController

  get base_path() { return '/score'; }

  constructor(app: Express) {
    super(app, [scoreMiddleware]);

    this.scoreController = new ScoreController(app)
  }

  setupRoutes() {
    this.router.get('/', hello);
    this.router.post('/news2', this.scoreController.calcNEWS2.bind(this.scoreController));
  }
}