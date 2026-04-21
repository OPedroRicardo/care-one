
import { Express, Request, Response, RequestHandler } from 'express';
import { APIRouter } from '@api-service/routes/api-router.ts';
import AuthRouter from '@api-service/routes/app/AuthRouter.ts';
import HistoryRouter from '@api-service/routes/app/HistoryRouter.ts';
import ChatRouter from '@api-service/routes/app/ChatRouter.ts';

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

    const authRouter = new AuthRouter(app)
    const historyRouter = new HistoryRouter(app)
    const chatRouter = new ChatRouter(app)

    this.addChild(authRouter)
        .addChild(historyRouter)
        .addChild(chatRouter);
  }

  setupRoutes() {
    this.router.get('/', hello);
  }
}