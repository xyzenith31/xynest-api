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
    const authHeader = req.headers.authorization;
    const currentToken = authHeader ? authHeader.split(' ')[1] : null;

    const { data, error } = await supabase.from('devices').select('*').eq('user_id', user.id);

    if (error) throw error;

    const devicesWithFlag = data.map((device) => ({
      ...device,
      is_current_device: device.session_token === currentToken,
    }));

    return res.status(200).json({ success: true, data: devicesWithFlag });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const revokeDeviceSession = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { deviceId } = req.params;

    const { error, count } = await supabase
      .from('devices')
      .delete({ count: 'exact' })
      .match({ id: deviceId, user_id: user.id });

    if (error) throw error;

    if (count === 0) {
      return res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan atau sudah dikeluarkan.' });
    }

    return res.status(200).json({ success: true, message: 'Sesi perangkat berhasil dihentikan dari Supabase.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const authorizeQRLoginController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { qr_token, device_model, platform, os_version } = req.body;

    if (!qr_token) {
      return res.status(400).json({ error: 'QR Token wajib disertakan dari hasil scan.' });
    }

    const { data: qrData, error: qrError } = await supabase
      .from('qr_sessions')
      .select('*')
      .eq('token', qr_token)
      .single();

    if (qrError || !qrData) {
      return res.status(404).json({ error: 'QR Token tidak ditemukan.' });
    }

    if (qrData.status !== 'PENDING') {
      return res.status(400).json({ error: 'QR Token sudah digunakan atau tidak valid.' });
    }

    if (new Date() > new Date(qrData.expires_at)) {
      return res.status(400).json({ error: 'QR Token sudah kedaluwarsa.' });
    }

    const sessionToken = await createDeviceSessionHelper(user.id, {
      device_model: device_model || 'Desktop Login via QR',
      platform: platform || 'Desktop/Web',
      os_version: os_version || 'Unknown'
    });

    const { error: updateError } = await supabase
      .from('qr_sessions')
      .update({
        status: 'AUTHORIZED',
        user_id: user.id,
        session_token: sessionToken
      })
      .eq('token', qr_token);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: 'Otorisasi berhasil. Perangkat desktop sekarang sudah terhubung.'
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};