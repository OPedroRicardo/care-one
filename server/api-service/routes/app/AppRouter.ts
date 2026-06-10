
import { Express, Request, Response, RequestHandler } from 'express';
import { APIRouter } from '@api-service/routes/api-router.ts';
import AuthRouter from '@api-service/routes/app/AuthRouter.ts';
import HistoryRouter from '@api-service/routes/app/HistoryRouter.ts';
import ChatRouter from '@api-service/routes/app/ChatRouter.ts';
import OperadoraRouter from '@api-service/routes/app/OperadoraRouter.ts';
import AppointmentRouter from '@api-service/routes/app/AppointmentRouter.ts';
import ExamRouter from '@api-service/routes/app/ExamRouter.ts';
import MedicoRouter from '@api-service/routes/app/MedicoRouter.ts';

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

    const authRouter        = new AuthRouter(app)
    const historyRouter     = new HistoryRouter(app)
    // const chatRouter        = new ChatRouter(app)
    const operadoraRouter   = new OperadoraRouter(app)
    const appointmentRouter = new AppointmentRouter(app)
    const examRouter        = new ExamRouter(app)
    const medicoRouter      = new MedicoRouter(app)

    this.addChild(authRouter)
        .addChild(historyRouter)
        // .addChild(chatRouter)
        .addChild(operadoraRouter)
        .addChild(appointmentRouter)
        .addChild(examRouter)
        .addChild(medicoRouter);
  }

  setupRoutes() {
    this.router.get('/', hello);
  }
}