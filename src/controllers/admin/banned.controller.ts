import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

export const getUsersForAdmin = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, 
        username, 
        email, 
        full_name, 
        phone_number, 
        gender, 
        birth_date, 
        role,
        status,
        banned_users (
          reason,
          banned_at,
          expires_at,
          appeal_reason,
          appeal_text
        )
      `);

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    const usersWithStatus = await Promise.all(data.map(async (user: any) => {
      const banRecord = Array.isArray(user.banned_users) ? user.banned_users[0] : user.banned_users;
      let trueStatus = 'ACTIVE';
      
      if (banRecord) {
        if (banRecord.appeal_reason && banRecord.appeal_text) {
          trueStatus = 'PENDING';
        } else {
          trueStatus = 'BANNED';
        }
      }

      if (user.status !== trueStatus) {
        await supabase.from('users').update({ status: trueStatus }).eq('id', user.id);
        user.status = trueStatus;
      }

      return {
        ...user,
        status: trueStatus,
        ban_details: trueStatus !== 'ACTIVE' ? banRecord : null
      };
    }));

    return res.status(200).json({ success: true, data: usersWithStatus });
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
      case 'minutes': expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(duration_value)); break;
      case 'hours': expiresAt.setHours(expiresAt.getHours() + parseInt(duration_value)); break;
      case 'days': expiresAt.setDate(expiresAt.getDate() + parseInt(duration_value)); break;
      case 'weeks': expiresAt.setDate(expiresAt.getDate() + (parseInt(duration_value) * 7)); break;
      case 'months': expiresAt.setMonth(expiresAt.getMonth() + parseInt(duration_value)); break;
      case 'years': expiresAt.setFullYear(expiresAt.getFullYear() + parseInt(duration_value)); break;
      default: return res.status(400).json({ error: 'Format durasi tidak valid.' });
    }

    const { error: userError } = await supabase.from('users').update({ status: 'BANNED' }).eq('id', user_id);
    if (userError) throw userError;

    const { data, error } = await supabase.from('banned_users').upsert({
      user_id,
      reason,
      banned_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    }, { onConflict: 'user_id' }).select();

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Pengguna berhasil diban.', data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const unbanUserController = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID diperlukan.' });
    }

    const { error: userError } = await supabase.from('users').update({ status: 'ACTIVE' }).eq('id', user_id);
    if (userError) throw userError;

    const { error } = await supabase.from('banned_users').delete().eq('user_id', user_id);
    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Status banned berhasil dicabut. Pengguna sekarang ACTIVE.' });
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
      .select('id, status, banned_users(*)')
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .single();

    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    const banRecord = Array.isArray(user.banned_users) ? user.banned_users[0] : user.banned_users;

    if (!banRecord) {
      if (user.status !== 'ACTIVE') {
         await supabase.from('users').update({ status: 'ACTIVE' }).eq('id', user.id);
      }
      return res.status(400).json({ error: 'Pengguna tidak dalam status penangguhan (banned).' });
    }

    if (banRecord.appeal_reason && banRecord.appeal_text) {
      return res.status(400).json({ error: 'Anda sudah mengajukan banding sebelumnya. Harap tunggu tinjauan admin.' });
    }

    const { error: userError } = await supabase.from('users').update({ status: 'PENDING' }).eq('id', user.id);
    if (userError) throw userError;

    const { error } = await supabase
      .from('banned_users')
      .update({
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

export const getAppealsController = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('banned_users')
      .select('*, users(username, email, full_name, status)');

    if (error) throw error;

    const validAppeals = data.filter((item: any) => item.appeal_reason && item.appeal_text);

    return res.status(200).json({ success: true, data: validAppeals });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};