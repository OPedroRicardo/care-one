import express, { Application } from 'express';
import cors from 'cors';
import { setupRouters } from './routes/index.js';

export class APIService {
  app: Application;

  constructor () {
    this.app = express();
  }

  init () {
    this.app.use(cors());
    this.app.use(express.json());

    this.app.get('/', (_, res) => {
      res.json({ message: "AI Server is running!" });
    });

    setupRouters(this.app);

    this.app.listen(process.env.PORT, () => {
      console.log(`Server running on http://localhost:${process.env.PORT}`);
    });
  }
}
