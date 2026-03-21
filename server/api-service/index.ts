import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

import { APIRouter } from './routes/router.ts'
// import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();

// Security stack
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS }));
app.use(express.json()); // Body limit contra DoS

// Rotas
const router = new APIRouter(app);
router.mount();

app.listen(process.env.PORT, () => {
  console.log(`OK! Process running on port ${process.env.PORT}`);
})

export default app;