import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { generateOTP, sendOTPEmail } from '../../utils/auth.helper';
import { getLoginMailTemplate } from '../../mails/login.mail';
import crypto from 'crypto';

export const requestLoginController = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body; 

    if (!identifier) {
      return res.status(400).json({ error: 'Harap masukkan Email, Username, atau Nomor Ponsel Anda.' });
    }

    let user = null;
    let errorMsg = 'Akun tidak ditemukan.';

    if (identifier.includes('@') && !identifier.startsWith('@')) {
      const { data, error } = await supabase.from('users').select('*').eq('email', identifier).maybeSingle();
      if (error) throw error;
      if (!data) errorMsg = 'Email tidak ditemukan di sistem kami. Silakan daftar terlebih dahulu.';
      user = data;

    } else if (identifier.startsWith('@')) {
      const { data, error } = await supabase.from('users').select('*').eq('username', identifier).maybeSingle();
      if (error) throw error;
      if (!data) errorMsg = 'Username tidak ditemukan di sistem kami. Periksa kembali penulisan Anda.';
      user = data;

    } else if (identifier.startsWith('+')) {
      const { data, error } = await supabase.from('users').select('*').eq('phone_number', identifier).maybeSingle();
      if (error) throw error;
      if (!data) errorMsg = 'Nomor ponsel tidak ditemukan di sistem kami.';
      user = data;

    } else {
      const isNumeric = /^\d+$/.test(identifier); 
      if (isNumeric) {
        const { data } = await supabase.from('users').select('*').eq('phone_number', `+${identifier}`).maybeSingle();
        if (!data) errorMsg = 'Nomor ponsel tidak ditemukan di sistem kami.';
        user = data;
      } else {
        const { data } = await supabase.from('users').select('*').or(`username.eq.${identifier},username.eq.@${identifier}`).maybeSingle();
        if (!data) errorMsg = 'Username tidak ditemukan di sistem kami. Periksa kembali penulisan Anda.';
        user = data;
      }
    }

    if (!user) {
      return res.status(404).json({ error: errorMsg });
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabase.from('pending_users').upsert({
      email: user.email,
      username: 'LOGIN_SESSION', 
      full_name: 'LOGIN_SESSION',
      gender: 'LOGIN_SESSION',
      birth_date: '2000-01-01',
      otp_code: otpCode,
      expired_at: expiresAt, 
    }, { onConflict: 'email' });

    if (upsertError) throw upsertError;

    const emailHtml = getLoginMailTemplate(otpCode);
    await sendOTPEmail(user.email, 'Kode Akses Masuk XyNest', emailHtml);

    return res.status(200).json({
      success: true,
      message: 'Kode OTP telah dikirim ke email Anda.',
      email: user.email 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const verifyLoginController = async (req: Request, res: Response) => {
  try {
    const { identifier, otp_code, device_model, platform, os_version } = req.body;

    if (!identifier || !otp_code) {
        return res.status(400).json({ error: 'Data login atau kode OTP tidak lengkap.' });
    }

    let user = null;
    if (identifier.includes('@') && !identifier.startsWith('@')) {
      const { data } = await supabase.from('users').select('*').eq('email', identifier).maybeSingle();
      user = data;
    } else if (identifier.startsWith('@')) {
      const { data } = await supabase.from('users').select('*').eq('username', identifier).maybeSingle();
      user = data;
    } else if (identifier.startsWith('+')) {
      const { data } = await supabase.from('users').select('*').eq('phone_number', identifier).maybeSingle();
      user = data;
    } else {
      const { data } = await supabase.from('users').select('*').eq('username', identifier).maybeSingle();
      user = data;
    }

    if (!user) {
      return res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
    }

    const { data: otpRecord, error: otpError } = await supabase
      .from('pending_users')
      .select('*')
      .eq('email', user.email)
      .single();

    if (otpError || !otpRecord || otpRecord.otp_code !== otp_code) {
      return res.status(400).json({ error: 'Kode OTP tidak valid atau salah.' });
    }

    if (new Date() > new Date(otpRecord.expired_at)) {
      return res.status(400).json({ error: 'Kode OTP sudah kedaluwarsa. Silakan minta ulang.' });
    }

    await supabase.from('pending_users').delete().eq('email', user.email);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const { error: deviceError } = await supabase.from('devices').insert({
      user_id: user.id,
      session_token: sessionToken,
      device_model: device_model || 'Unknown Device',
      platform: platform || 'Unknown Platform',
      os_version: os_version || 'Unknown OS',
      email: user.email,
      username: user.username
    });

    if (deviceError) throw deviceError;

    return res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      session_token: sessionToken,
      user
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const generateQRTokenController = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    await supabase.from('pending_qrcodes').delete().lt('expires_at', now.toISOString());
    const qrToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); 

    const { error } = await supabase.from('pending_qrcodes').insert({
      qr_token: qrToken,
      status: 'PENDING',
      expires_at: expiresAt
    });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'QR Token berhasil dibuat.',
      qr_token: qrToken,
      expires_at: expiresAt
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const checkQRStatusController = async (req: Request, res: Response) => {
  try {
    const qr_token = req.params.qr_token as string; 
    const { data: qrData, error } = await supabase.from('pending_qrcodes').select('*').eq('qr_token', qr_token).single();

    if (error || !qrData) return res.status(404).json({ error: 'QR Token tidak ditemukan atau sudah tidak valid.' });
    if (new Date() > new Date(qrData.expires_at)) {
      await supabase.from('pending_qrcodes').delete().eq('qr_token', qr_token);
      return res.status(400).json({ error: 'QR Token sudah kedaluwarsa.' });
    }

    if (qrData.status === 'AUTHORIZED') {
      const { data: user } = await supabase.from('users').select('*').eq('id', qrData.user_id).single();
      const { data: device } = await supabase.from('devices').select('*').eq('session_token', qrData.session_token).single();
      await supabase.from('pending_qrcodes').delete().eq('qr_token', qr_token);

      return res.status(200).json({ success: true, status: 'AUTHORIZED', session_token: qrData.session_token, device, user });
    }
    return res.status(200).json({ success: true, status: qrData.status });
  } catch (err: any) {
     return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};