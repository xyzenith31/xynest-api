import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import registerRoutes from './routes/auth/register.routes';
import verifyRoutes from './routes/auth/verify.routes';
import loginRoutes from './routes/auth/login.routes';
import deviceRoutes from './routes/auth/device.routes';
import userRoutes from './routes/auth/user.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser()); 

app.use('/api/auth', registerRoutes);
app.use('/api/auth', verifyRoutes);
app.use('/api/auth', loginRoutes);
app.use('/api/auth', deviceRoutes);
app.use('/api/auth', userRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Server Express + TypeScript + Supabase berjalan lancar, bro!');
});

app.listen(PORT, () => {
  console.log(`⚡️ [server]: Server running di http://localhost:${PORT}`);
});