import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { supabase } from './config/supabase';

import registerRoutes from './routes/auth/register.routes';
import verifyRoutes from './routes/auth/verify.routes';
import loginRoutes from './routes/auth/login.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser()); 

app.use('/api/auth', registerRoutes);
app.use('/api/auth', verifyRoutes);
app.use('/api/auth', loginRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Server Express + TypeScript + Supabase berjalan lancar, bro!');
});

app.listen(PORT, () => {
  console.log(`⚡️ [server]: Server running di http://localhost:${PORT}`);
});