import { DocumentService } from "../services/Documents.service.js";
import { Request, Response } from "express";

export class DocumentMiddleware {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  async upload(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const { collectionName } = req.body;

      if (!collectionName) {
        return res.status(400).json({ error: "collectionName é obrigatório" });
      }

      const uint8Array = new Uint8Array(req.file.buffer);
      const fileBlob = new Blob([uint8Array], { 
        type: req.file.mimetype 
      });

      await this.documentService.indexDocument(fileBlob, collectionName);

      res.json({
        message: "Documento indexado com sucesso",
        collectionName,
        filename: req.file.originalname,
      });
    } catch (error) {
      console.error("Erro ao indexar documento:");
      console.error(error)
      res.status(500).json({ 
        error: "Erro ao processar documento",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async list(_: Request, res: Response) {
    try {
      const collections = await this.documentService.listCollections();
      res.json({ collections });
    } catch (error) {
      console.error("Erro ao listar coleções:", error);
      res.status(500).json({ error: "Erro ao listar coleções" });
    }
  }
}