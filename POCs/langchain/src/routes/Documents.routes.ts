import { Router } from "express";
import { DocumentMiddleware } from "../middlewares/Document.middleware.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export class DocumentsRoutes {
  private router: Router;
  private documentMiddleware: DocumentMiddleware;

  constructor() {
    this.router = Router();
    this.documentMiddleware = new DocumentMiddleware();
    this.setup();
  }

  get name() {
    return "documents";
  }

  setup() {
    this.router.post(
      "/upload",
      upload.single("file"),
      this.documentMiddleware.upload.bind(this.documentMiddleware)
    );
    
    this.router.get(
      "/collections",
      this.documentMiddleware.list.bind(this.documentMiddleware)
    );
  }

  getRouter() {
    return this.router;
  }
}