import { Router } from "express";
import { ChatMiddleware } from "../middlewares/Chat.middleware.js";

export class ChatRoutes {
  private router: Router;
  private chatMiddleware: ChatMiddleware;

  constructor() {
    this.router = Router();
    this.chatMiddleware = new ChatMiddleware();
    this.setup();
  }

  get name() {
    return "chat";
  }

  setup() {
    this.router.post(
      "/message",
      this.chatMiddleware.sendMessage.bind(this.chatMiddleware)
    );

    this.router.get(
      "/:id",
      this.chatMiddleware.getChat.bind(this.chatMiddleware)
    );

    this.router.delete(
      "/:id",
      this.chatMiddleware.deleteChat.bind(this.chatMiddleware)
    );
  }

  getRouter() {
    return this.router;
  }
}