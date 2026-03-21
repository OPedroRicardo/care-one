
import { Express, Request, Response, RequestHandler } from 'express';
import { APIRouter } from '../router';

// Exemplo de middleware próprio do Auth
const authMiddleware: RequestHandler = (req, res, next) => {
  // Pode adicionar lógica específica do Auth
  // console.log('Auth middleware');
  next();
};

const hello = (_: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Funfando o auth!' });
};

export default class AuthRouter extends APIRouter {
  get base_path() { return '/auth'; }

  constructor(app: Express) {
    super(app, [authMiddleware]);
  }

  setupRoutes() {
    this.router.get('/', hello);
  }
}