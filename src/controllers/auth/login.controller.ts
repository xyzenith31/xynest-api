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
      const { data, error } = await supabase.from('users').select('*').eq('username', identifier).maybeSingle();
      if (error) throw error;
      if (!data) errorMsg = 'Username tidak ditemukan. Pastikan diawali dengan karakter yang benar.';
      user = data;
    }

    if (!user) {
      return res.status(404).json({ error: errorMsg });
    }

    const otp = generateOTP();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await supabase.from('pending_users').upsert({
      email: user.email,
      username: 'LOGIN_SESSION',
      full_name: 'LOGIN_SESSION',
      gender: 'LOGIN_SESSION',
      birth_date: '2000-01-01',
      phone_number: user.phone_number || '',
      otp_code: otp,
      expired_at: expiredAt
    }, { onConflict: 'email' });

    const emailHtml = getLoginMailTemplate(otp);
    await sendOTPEmail(user.email, 'Otentikasi Sesi Masuk - XyNest Project', emailHtml);

    return res.status(200).json({ 
      success: true, 
      message: 'Kode OTP login berhasil dikirim ke email Anda.' 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const verifyLoginController = async (req: Request, res: Response) => {
  try {
    const { identifier, otp_code, device_model, platform, os_version } = req.body;

    if (!identifier || !otp_code) {
      return res.status(400).json({ error: 'Identifier dan kode OTP wajib diisi.' });
    }

    let user = null;
    if (identifier.includes('@') && !identifier.startsWith('@')) {
      const { data } = await supabase.from('users').select('*').eq('email', identifier).maybeSingle();
      user = data;
    } else if (identifier.startsWith('@')) {
      const { data } = await supabase.from('users').select('*').eq('username', identifier).maybeSingle();
      user = data;
    } else {
      const { data } = await supabase.from('users').select('*').eq('phone_number', identifier).maybeSingle();
      user = data;
    }

    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const { data: pending } = await supabase.from('pending_users').select('*').eq('email', user.email).single();

    if (!pending) return res.status(400).json({ error: 'Sesi login kedaluwarsa atau tidak ditemukan.' });
    if (pending.otp_code !== otp_code.toUpperCase()) return res.status(400).json({ error: 'Kode OTP salah.' });
    if (new Date() > new Date(pending.expired_at)) return res.status(400).json({ error: 'Kode OTP kedaluwarsa.' });

    await supabase.from('pending_users').delete().eq('email', user.email);

    const sessionToken = crypto.randomBytes(32).toString('hex');

    const { error: deviceError } = await supabase.from('devices').insert({
      user_id: user.id,
      session_token: sessionToken,
      device_model: device_model || 'Unknown Device',
      platform: platform || 'Unknown Platform',
      os_version: os_version || 'Unknown OS'
    });

    if (deviceError) throw deviceError;

    return res.status(200).json({ 
      success: true, 
      message: 'Login Sukses! Sesi perangkat berhasil disimpan.', 
      session_token: sessionToken, 
      user 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const qrMemorySessions = new Map<string, any>();

export const generateQRTokenController = async (req: Request, res: Response) => {
  try {
    const qrToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    qrMemorySessions.set(qrToken, {
      status: 'PENDING',
      expires_at: expiresAt
    });

    return res.status(200).json({
      success: true,
      message: 'QR Token berhasil dibuat.',
      qr_token: qrToken,
      expires_at: expiresAt.toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const checkQRStatusController = async (req: Request, res: Response) => {
  try {
    const qr_token = req.params.qr_token as string; 
    const qrData = qrMemorySessions.get(qr_token);

    if (!qrData) {
      return res.status(404).json({ error: 'QR Token tidak ditemukan atau sudah tidak valid.' });
    }

    if (new Date() > qrData.expires_at) {
      qrMemorySessions.delete(qr_token);
      return res.status(400).json({ error: 'QR Token sudah kedaluwarsa.' });
    }

    if (qrData.status === 'AUTHORIZED') {
      const { data: user } = await supabase.from('users').select('*').eq('id', qrData.user_id).single();

      qrMemorySessions.delete(qr_token);

      return res.status(200).json({
        success: true,
        status: 'AUTHORIZED',
        session_token: qrData.session_token,
        user
      });
    }

    return res.status(200).json({
      success: true,
      status: qrData.status 
    });
  } catch (err: any) {
     return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

export const authorizeQRLoginController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const qr_token = req.body.qr_token as string; 
    const device_model = req.body.device_model as string;
    const platform = req.body.platform as string;
    const os_version = req.body.os_version as string;

    if (!qr_token) {
      return res.status(400).json({ error: 'QR Token wajib disertakan.' });
    }

    const qrData = qrMemorySessions.get(qr_token);

    if (!qrData) {
      return res.status(404).json({ error: 'QR Token tidak valid atau tidak ditemukan.' });
    }
    if (qrData.status !== 'PENDING') {
      return res.status(400).json({ error: 'QR Token sudah digunakan.' });
    }
    if (new Date() > qrData.expires_at) {
      qrMemorySessions.delete(qr_token);
      return res.status(400).json({ error: 'QR Token sudah kedaluwarsa.' });
    }

    const newSessionToken = crypto.randomBytes(32).toString('hex'); 
    
    const { error: deviceError } = await supabase.from('devices').insert({
      user_id: user.id,
      session_token: newSessionToken,
      device_model: device_model || 'XyNest Web / Desktop',
      platform: platform || 'Web',
      os_version: os_version || 'Unknown'
    });

    if (deviceError) throw deviceError;

    qrMemorySessions.set(qr_token, {
      status: 'AUTHORIZED',
      user_id: user.id,
      session_token: newSessionToken,
      expires_at: qrData.expires_at
    });

    return res.status(200).json({
      success: true,
      message: 'Otorisasi berhasil. Sesi login telah diduplikat untuk web.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};