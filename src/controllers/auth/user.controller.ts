import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

export const logoutController = async (req: Request, res: Response) => {
  try {
    const token = (req as any).session_token;

    if (!token) {
      return res.status(400).json({ error: 'Token sesi tidak ditemukan di server.' });
    }

    const { data, error } = await supabase
      .from('devices')
      .delete()
      .eq('session_token', token)
      .select(); 

    if (error) {
      return res.status(500).json({ error: 'Gagal menghapus sesi dari database.' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Berhasil keluar dan sesi dihapus dari database.',
      deleted_data: data 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error saat mencoba logout.' });
  }
};

export const deleteUserController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ error: 'User tidak valid atau tidak terautentikasi.' });
    }

    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)
      .select();

    if (error) {
      return res.status(500).json({ error: 'Gagal menghapus akun dari Supabase.' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Akun dan seluruh sesi perangkat berhasil dihapus permanen dari sistem.',
      deleted_data: data
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error saat menghapus akun.' });
  }
};

export const checkStatusController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      return res.status(401).json({ error: 'User tidak valid atau tidak terautentikasi.' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('status, banned_users(reason, expires_at)')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Data pengguna tidak ditemukan.' });
    }

    return res.status(200).json({
      success: true,
      status: data.status,
      ban_details: data.banned_users
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error saat mengecek status.' });
  }
};