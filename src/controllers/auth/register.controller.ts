import { Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { generateOTP, sendOTPEmail } from "../../utils/auth.helper";
import { getRegisterMailTemplate } from "../../mails/register.mail";

export const registerController = async (req: Request, res: Response) => {
  try {
    let { email, username, full_name, gender, birth_date, phone_number } =
      req.body;
    gender = gender.toUpperCase();
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(full_name)}&background=random`;
    const allowedDomains = [
      "@gmail.com",
      "@icloud.com",
      "@outlook.com",
      "@hotmail.com",
      "@yahoo.com",
      "@xynest.com",
    ];
    const hasAllowedDomain = allowedDomains.some((domain) =>
      email.toLowerCase().endsWith(domain),
    );

    if (!hasAllowedDomain) {
      return res.status(400).json({
        error:
          "Pendaftaran gagal! Domain email tidak diizinkan. Hanya menerima email dari: @gmail.com, @icloud.com, @outlook.com, @hotmail.com, @yahoo.com, dan @xynest.com",
      });
    }

    if (!username.startsWith("@")) {
      return res
        .status(400)
        .json({ error: "Username harus diawali dengan karakter @" });
    }

    const phoneRegex = /^\+(62|84|66|65|86|81)[1-9][0-9]{7,12}$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({
        error:
          "Format nomor ponsel salah! Harus menggunakan kode negara internasional (+62, dll), dan angka setelah kode negara tidak boleh diawali dengan angka 0.",
      });
    }

    const dateParts = birth_date.split("/");
    if (dateParts.length !== 3) {
      return res
        .status(400)
        .json({
          error: "Format tanggal lahir harus DD/MM/YYYY (Contoh: 31/05/2007)",
        });
    }
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const year = parseInt(dateParts[2], 10);
    const formattedBirthDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const birthDateObj = new Date(formattedBirthDate + "T00:00:00Z");
    const today = new Date();

    let age = today.getUTCFullYear() - birthDateObj.getUTCFullYear();
    const m = today.getUTCMonth() - birthDateObj.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < birthDateObj.getUTCDate())) {
      age--;
    }

    if (age < 17) {
      return res
        .status(400)
        .json({
          error: `Pendaftaran gagal. Umur minimal adalah 17 tahun. Umur Anda terdeteksi ${age} tahun.`,
        });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("email, username, phone_number")
      .or(
        `email.eq.${email},username.eq.${username},phone_number.eq.${phone_number}`,
      )
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      const conflict = existingUser[0];
      if (conflict.email === email) {
        return res.status(400).json({ error: "Email sudah terdaftar." });
      }
      if (conflict.username === username) {
        return res.status(400).json({ error: "Username sudah terdaftar." });
      }
      if (conflict.phone_number === phone_number) {
        return res.status(400).json({ error: "Nomor ponsel sudah terdaftar." });
      }
      return res.status(400).json({ error: "Data sudah terdaftar di sistem." });
    }

    const otpCode = generateOTP();
    const expiredAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabase.from("pending_users").upsert(
      {
        email,
        username,
        full_name,
        gender,
        birth_date: formattedBirthDate,
        phone_number,
        otp_code: otpCode,
        profiles: avatarUrl,
        expired_at: expiredAt,
      },
      { onConflict: "email" },
    );

    if (upsertError) {
      return res.status(400).json({ error: upsertError.message });
    }

    const emailHtml = getRegisterMailTemplate(full_name, otpCode);
    await sendOTPEmail(
      email,
      "Verifikasi Akun Baru - XyNest Project",
      emailHtml,
    );

    return res.status(200).json({
      success: true,
      message:
        "Kode verifikasi OTP berhasil dikirim ke email. Silakan cek kotak masuk Anda dalam 30 menit.",
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
