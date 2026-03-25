import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';

import { APIRouter } from './routes/router.ts'
// import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();

// Security stack
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS }));
app.use(express.json()); // Body limit contra DoS

// HTTP request logger
const STATUS_COLORS: Record<string, string> = {
  '2': '\x1b[32m', // green  — 2xx
  '3': '\x1b[36m', // cyan   — 3xx
  '4': '\x1b[33m', // yellow — 4xx
  '5': '\x1b[31m', // red    — 5xx
}
const RESET = '\x1b[0m'
const DIM   = '\x1b[2m'
const BOLD  = '\x1b[1m'

morgan.token('status-colored', (_req, res) => {
  const s     = String(res.statusCode)
  const color = STATUS_COLORS[s[0]] ?? RESET
  return `${color}${BOLD}${s}${RESET}`
})

app.use(morgan(
  `${DIM}:method${RESET} :url  :status-colored  ${DIM}:response-time ms${RESET}`
))

// Rotas
const router = new APIRouter(app);
router.mount();

app.listen(process.env.PORT, () => {
  console.log(`OK! Process running on port ${process.env.PORT}`);
})

export default app;