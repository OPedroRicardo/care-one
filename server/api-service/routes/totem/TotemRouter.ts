
import { Express, Request, Response, RequestHandler } from 'express';
import { APIRouter } from '../router';
import AuthRouter from './AuthRouter';
import ScoreRouter from './ScoreRouter';

// Exemplo de middleware próprio do Totem
const totemMiddleware: RequestHandler = (req, res, next) => {
  // Pode adicionar lógica específica do Totem
  // console.log('Totem middleware');
  next();
};

const hello = (_: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Funfando o totem!' });
};

export default class TotemRouter extends APIRouter {
  get base_path() { return '/totem'; }

  constructor(app: Express) {
    super(app, [totemMiddleware]);
    // Adiciona sub-routers
    this.addChild(new AuthRouter(app));
    this.addChild(new ScoreRouter(app));
  }

  setupRoutes() {
    this.router.get('/', hello);
  }
}