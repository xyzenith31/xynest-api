import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import crypto from 'crypto';

export const createDeviceSessionHelper = async (userId: string, deviceInfo: any) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const { device_model, platform, os_version } = deviceInfo;

  const { data, error } = await supabase.from('devices').insert({
    user_id: userId,
    session_token: sessionToken,
    device_model: device_model || 'Unknown Device',
    platform: platform || 'Unknown Platform',
    os_version: os_version || 'Unknown OS',
  }).select().single();

  if (error) throw new Error(error.message);
  return sessionToken;
};

export const getActiveDevices = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { data, error } = await supabase.from('devices').select('*').eq('user_id', user.id);

    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const revokeDeviceSession = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { deviceId } = req.params;

    const { error } = await supabase.from('devices').delete().match({ id: deviceId, user_id: user.id });

    if (error) throw error;
    return res.status(200).json({ success: true, message: 'Sesi perangkat berhasil dihentikan/dihapus dari Supabase.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};