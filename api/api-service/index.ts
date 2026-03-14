import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import useLogger from './middlewares/loggerMiddleware.js'
import { APIRouter } from './routes/router.ts'
// import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();

// Security stack
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS }));
app.use(express.json()); // Body limit contra DoS

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Rotas
const router = new APIRouter(app);
router.mount();

// Logging e error handling
app.use(useLogger());

app.listen(process.env.PORT, () => {
  console.log(`OK! Process running on port ${process.env.PORT}`);
})

export default app;