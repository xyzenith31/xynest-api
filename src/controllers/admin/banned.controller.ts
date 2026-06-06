import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

export const getUsersForAdmin = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, full_name, phone_number, gender, birth_date, role');

    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const banUserController = async (req: Request, res: Response) => {
  try {
    const { user_id, reason, duration_value, duration_unit } = req.body;

    if (!user_id || !reason || !duration_value || !duration_unit) {
      return res.status(400).json({ error: 'Data ban tidak lengkap.' });
    }

    const now = new Date();
    let expiresAt = new Date(now);

    switch (duration_unit) {
      case 'hours': expiresAt.setHours(expiresAt.getHours() + parseInt(duration_value)); break;
      case 'days': expiresAt.setDate(expiresAt.getDate() + parseInt(duration_value)); break;
      case 'weeks': expiresAt.setDate(expiresAt.getDate() + (parseInt(duration_value) * 7)); break;
      case 'months': expiresAt.setMonth(expiresAt.getMonth() + parseInt(duration_value)); break;
      case 'years': expiresAt.setFullYear(expiresAt.getFullYear() + parseInt(duration_value)); break;
      default: return res.status(400).json({ error: 'Format durasi tidak valid.' });
    }

    const { data, error } = await supabase.from('banned_users').upsert({
      user_id,
      reason,
      banned_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      appeal_status: 'NONE'
    }, { onConflict: 'user_id' }).select();

    if (error) throw error;
    await supabase.from('devices').delete().eq('user_id', user_id);

    return res.status(200).json({ success: true, message: 'Pengguna berhasil diban.', data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const getAppealsController = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('banned_users')
      .select('*, users(username, email, full_name)')
      .eq('appeal_status', 'PENDING');

    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const submitAppealController = async (req: Request, res: Response) => {
  try {
    const { identifier, appeal_reason, appeal_text } = req.body;

    if (!identifier || !appeal_reason || !appeal_text) {
      return res.status(400).json({ error: 'Data banding tidak lengkap.' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .single();

    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    const { error } = await supabase
      .from('banned_users')
      .update({
        appeal_status: 'PENDING',
        appeal_reason,
        appeal_text,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Banding berhasil dikirim. Menunggu tinjauan admin.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};