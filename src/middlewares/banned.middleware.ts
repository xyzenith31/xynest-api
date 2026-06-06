import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest } from './auth.middleware';

export const checkBannedMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next();

    const { data: banRecord } = await supabase
      .from('banned_users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (banRecord) {
      if (new Date(banRecord.expires_at) > new Date()) {
        return res.status(403).json({
          error: 'Sesi dihentikan. Akun ditangguhkan oleh sistem.',
          is_banned: true,
          ban_details: banRecord
        });
      } else {
        await supabase.from('banned_users').delete().eq('user_id', user.id);
      }
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa status akun.' });
  }
};

export const requireAdminMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user || user.role !== 'administrator') {
    return res.status(403).json({ error: 'Akses ditolak. Membutuhkan izin Administrator.' });
  }
  next();
};