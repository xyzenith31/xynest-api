import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { sendOTPEmail, generateOTP } from '../../utils/auth.helper';
import { getRegisterMailTemplate } from '../../mails/register.mail';
import { getLoginMailTemplate } from '../../mails/login.mail';
import jwt from 'jsonwebtoken';

export const verifyRegisterController = async (req: Request, res: Response) => {
  try {
    const { email, otp_code } = req.body;

    const { data: pending, error } = await supabase
      .from('pending_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !pending) {
      return res.status(400).json({ error: 'Data registrasi tidak ditemukan atau sudah kedaluwarsa.' });
    }

    if (pending.otp_code !== otp_code.toUpperCase()) {
      return res.status(400).json({ error: 'Kode OTP yang dimasukkan salah.' });
    }

    if (new Date() > new Date(pending.expired_at)) {
      return res.status(400).json({ error: 'Kode OTP sudah kedaluwarsa (lebih dari 5 menit).' });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email: pending.email,
        username: pending.username,
        full_name: pending.full_name,
        gender: pending.gender,
        birth_date: pending.birth_date,
        phone_number: pending.phone_number
      })
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    await supabase.from('pending_users').delete().eq('email', email);
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.cookie('session_token', token, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 }); // 1 hari
    return res.status(200).json({ success: true, message: 'Verifikasi sukses, akun berhasil dibuat dan otomatis masuk.', data: newUser });

  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const resendOTPController = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const newOtp = generateOTP();
    const newExpired = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data: pending } = await supabase.from('pending_users').select('*').eq('email', email).maybeSingle();

    if (pending && pending.username !== 'LOGIN_SESSION') {
      await supabase.from('pending_users').update({ otp_code: newOtp, expired_at: newExpired }).eq('email', email);
      
      const emailHtml = getRegisterMailTemplate(pending.full_name, newOtp);
      await sendOTPEmail(email, 'Kirim Ulang Verifikasi Akun - XyNest Project', emailHtml);
      
      return res.status(200).json({ success: true, message: 'Kode OTP baru berhasil dikirim ulang.' });
    }

    const { data: user } = await supabase.from('users').select('email').eq('email', email).maybeSingle();
    if (user) {
      await supabase.from('pending_users').upsert({
        email: user.email,
        username: 'LOGIN_SESSION', 
        full_name: 'LOGIN_SESSION',
        gender: 'LOGIN_SESSION',
        birth_date: '2000-01-01',
        otp_code: newOtp,
        expired_at: newExpired
      }, { onConflict: 'email' });

      const emailHtml = getLoginMailTemplate(newOtp);
      await sendOTPEmail(email, 'Kirim Ulang Otentikasi Sesi Masuk - XyNest Project', emailHtml);
      
      return res.status(200).json({ success: true, message: 'Kode OTP baru berhasil dikirim ulang untuk login.' });
    }

    return res.status(400).json({ error: 'Email tidak ditemukan di sistem.' });

  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};