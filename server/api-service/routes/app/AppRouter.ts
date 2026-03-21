
import { Express, Request, Response, RequestHandler } from 'express';
import { APIRouter } from '../router';
import AuthRouter from './AuthRouter';
// import ScoreRouter from './ScoreRouter';

// Exemplo de middleware próprio do App
const appMiddleware: RequestHandler = (req, res, next) => {
  // Pode adicionar lógica específica do App
  // console.log('App middleware');
  next();
};

const hello = (_: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Funfando o app!' });
};

export default class AppRouter extends APIRouter {
  get base_path() { return '/app'; }

  constructor(app: Express) {
    super(app, [appMiddleware]);
    // Adiciona sub-routers
    this.addChild(new AuthRouter(app));
    // this.addChild(new ScoreRouter(app));
  }

  setupRoutes() {
    this.router.get('/', hello);
  }
}