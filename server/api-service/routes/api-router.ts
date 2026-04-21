import { Express, Router, RequestHandler, Request, Response } from 'express';

// Interface estrutural que quebra a dependência de identidade de módulo dos
// #private fields: addChild não precisa saber que o filho é "APIRouter do mesmo
// módulo" — só precisa saber que ele tem mountOn.
export interface IChildRouter {
  mountOn(parentRouter: Router): void;
}

export class APIRouter implements IChildRouter {
  #app: Express;
  #router: Router;
  #middlewares: RequestHandler[];
  #children: IChildRouter[];

  constructor(app: Express, middlewares: RequestHandler[] = []) {
    this.#app = app;
    this.#router = Router();
    this.#middlewares = middlewares;
    this.#children = [];
  }

  get base_path() { return '/'; }
  get app()        { return this.#app; }
  get router()     { return this.#router; }

  addChild(child: IChildRouter) {
    this.#children.push(child);
    return this;
  }

  setupRoutes() {
    this.#router.get('/', (_: Request, res: Response) => {
      res.status(200).json({ status: 'OK', message: 'Funfando!' });
    });
  }

  async mount() {
    this.setupRoutes();

    if (this.base_path === '/') {
      // import() dinâmico: garante que TotemRouter/AppRouter só sejam
      // avaliados depois que APIRouter está completamente definido,
      // evitando a circularidade de módulo.
      const { default: TotemRouter } = await import('@api-service/routes/totem/TotemRouter.ts');
      const { default: AppRouter }   = await import('@api-service/routes/app/AppRouter.ts');
      this.addChild(new TotemRouter(this.#app));
      this.addChild(new AppRouter(this.#app));
    }

    this.#app.use(this.base_path, ...this.#middlewares, this.#router);

    for (const child of this.#children) {
      child.mountOn(this.#router);
    }
  }

  mountOn(parentRouter: Router) {
    this.setupRoutes();
    parentRouter.use(this.base_path, ...this.#middlewares, this.#router);
    for (const child of this.#children) {
      child.mountOn(this.#router);
    }
  }
}
