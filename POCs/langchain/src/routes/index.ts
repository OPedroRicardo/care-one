import { Application } from "express";
import { ChatRoutes } from "./Chat.routes.js";
import { DocumentsRoutes } from "./Documents.routes.js";

export const setupRouters = (app: Application) => {
  const routers = [ChatRoutes, DocumentsRoutes];

  routers.forEach(Router => {
    const router = new Router();
    app.use(`/${router.name}`, router.getRouter());
  })
};