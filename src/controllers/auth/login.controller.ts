import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { generateOTP, sendOTPEmail } from '../../utils/auth.helper';
import { getLoginMailTemplate } from '../../mails/login.mail';
import jwt from 'jsonwebtoken';

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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${identifier},username.eq.${identifier},phone_number.eq.${identifier}`)
        .maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (!user) {
      return res.status(404).json({ error: errorMsg });
    }

    const otpCode = generateOTP();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await supabase.from('pending_users').upsert({
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      gender: user.gender,
      birth_date: user.birth_date,
      phone_number: user.phone_number,
      otp_code: otpCode,
      expired_at: expiredAt
    }, { onConflict: 'email' });

    const emailHtml = getLoginMailTemplate(otpCode);
    await sendOTPEmail(user.email, 'Kode Otentikasi Sesi Masuk - XyNest Project', emailHtml);

    return res.status(200).json({ 
      success: true, 
      message: `User ditemukan! Kode verifikasi login telah dikirim ke email terdaftar (${user.email}).` 
    });

  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const verifyLoginController = async (req: Request, res: Response) => {
  try {
    const { identifier, otp_code } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${identifier},username.eq.${identifier},phone_number.eq.${identifier}`)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    const { data: pending } = await supabase
      .from('pending_users')
      .select('*')
      .eq('email', user.email)
      .single();

    if (!pending) {
      return res.status(400).json({ error: 'Sesi login kedaluwarsa atau tidak ditemukan. Silakan ajukan masuk kembali.' });
    }

    if (pending.otp_code !== otp_code.toUpperCase()) {
      return res.status(400).json({ error: 'Kode OTP salah.' });
    }

    if (new Date() > new Date(pending.expired_at)) {
      return res.status(400).json({ error: 'Kode OTP kedaluwarsa.' });
    }

    await supabase.from('pending_users').delete().eq('email', user.email);

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.cookie('session_token', token, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });

    return res.status(200).json({ success: true, message: 'Login Sukses! Sesi berhasil disimpan.', user });

  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logoutController = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.session_token;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { email: string };
        if (decoded && decoded.email) {
          await supabase.from('pending_users').delete().eq('email', decoded.email);
        }
      } catch (jwtErr) {
      }
    }

    res.clearCookie('session_token');
    return res.status(200).json({ 
      success: true, 
      message: 'Berhasil keluar, cookie dan seluruh sesi database telah dihapus bersih.' 
    });

  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error saat mencoba logout.' });
  }
};