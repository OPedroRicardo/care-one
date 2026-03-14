import { Express, Router, RequestHandler, Request, Response } from 'express';

export class APIRouter {
  #app: Express;
  #router: Router;
  #middlewares: RequestHandler[];
  #children: APIRouter[];

  constructor(app: Express, middlewares: RequestHandler[] = []) {
    this.#app = app;
    this.#router = Router();
    this.#middlewares = middlewares;
    this.#children = [];
  }

  get base_path() { return '/'; }
  get app() { return this.#app; }
  get router() { return this.#router; }

  addChild(child: APIRouter) {
    this.#children.push(child);
  }

  // Para sobrescrever nos filhos
  setupRoutes() {
    this.#router.get('/', (_: Request, res: Response) => {
      res.status(200).json({ status: 'OK', message: 'Funfando!' });
    });
  }

  // Monta a hierarquia de routers e middlewares
  mount() {
    this.setupRoutes();
    // Adiciona sub-routers principais aqui para evitar importação circular
    if (this.base_path === '/') {
      // Importação dinâmica para evitar circularidade
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const TotemRouter = require('./totem/TotemRouter').default;
      this.addChild(new TotemRouter(this.#app));

      // const AppRouter = require('./app/AppRouter').default;
      // this.addChild(new AppRouter(this.#app));
    }
    // Monta middlewares e rotas deste router
    this.#app.use(this.base_path, ...this.#middlewares, this.#router);
    // Monta sub-routers
    for (const child of this.#children) {
      child.mountOn(this.#router);
    }
  }

  // Permite montar sub-routers em um router pai
  mountOn(parentRouter: Router) {
    this.setupRoutes();
    parentRouter.use(this.base_path, ...this.#middlewares, this.#router);
    for (const child of this.#children) {
      child.mountOn(this.#router);
    }
  }
}