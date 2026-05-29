import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import crypto from 'crypto';

interface DeviceSessionData {
  id: string;
  session_token: string;
  user_id: string;
  device_model: string;
  platform: string;
  os_version: string;
  email: string;
  username: string;
}

export const createDeviceSessionHelper = async (user: any, deviceInfo: any): Promise<DeviceSessionData> => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const { device_model, platform, os_version } = deviceInfo;

  const { data, error } = await supabase.from('devices').insert({
    user_id: user.id,
    session_token: sessionToken,
    device_model: device_model || 'Unknown Device',
    platform: platform || 'Website',
    os_version: os_version || 'Unknown OS',
    email: user.email,
    username: user.username
  }).select().single();

  if (error) throw new Error(error.message);
  
  return data as DeviceSessionData; 
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
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const revokeDeviceSession = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const user = (req as any).user;

    const { error } = await supabase.from('devices').delete().eq('id', deviceId).eq('user_id', user.id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Sesi perangkat berhasil dicabut.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
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
      .from('pending_qrcodes')
      .select('*')
      .eq('qr_token', qr_token)
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

    const newDeviceSession = await createDeviceSessionHelper(user, { 
      device_model: device_model || 'Desktop Login via QR',
      platform: platform || 'Website',
      os_version: os_version || 'Unknown'
    });

    const { error: updateError } = await supabase
      .from('pending_qrcodes')
      .update({
        status: 'AUTHORIZED',
        user_id: user.id,
        session_token: newDeviceSession.session_token
      })
      .eq('qr_token', qr_token);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: 'Otorisasi berhasil. Perangkat desktop sekarang sudah terhubung.',
      device_id: newDeviceSession.id 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const generateQRTokenController = async (req: Request, res: Response) => {
  try {
    const qrToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    const { error } = await supabase.from('pending_qrcodes').insert({
      qr_token: qrToken,
      status: 'PENDING',
      expires_at: expiresAt.toISOString(),
    });

    if (error) throw error;

    return res.status(200).json({ success: true, qr_token: qrToken });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const checkQRStatusController = async (req: Request, res: Response) => {
  try {
    const { qrToken } = req.params;
    
    const { data, error } = await supabase
      .from('pending_qrcodes')
      .select('*')
      .eq('qr_token', qrToken)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'QR Token tidak ditemukan.' });
    }

    return res.status(200).json({
      success: true,
      status: data.status,
      session_token: data.session_token
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};