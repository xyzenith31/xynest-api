import { Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { generateOTP, sendOTPEmail } from "../../utils/auth.helper";
import { getForgotAccountMailTemplate } from "../../mails/forgot.account.mail";
import { getResetEmailMailTemplate } from "../../mails/reset.email.mail";
import bcrypt from "bcrypt";

export const getProfileController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { data: userData, error } = await supabase
      .from("users")
      .select(
        "email, username, full_name, phone_number, gender, birth_date, profiles",
      )
      .eq("id", user.id)
      .single();

    if (error || !userData)
      return res.status(404).json({ error: "Data pengguna tidak ditemukan." });

    return res
      .status(200)
      .json({
        success: true,
        message: "Berhasil mengambil data profil pengguna.",
        data: userData,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error:
          err.message || "Internal Server Error saat mengambil data profil.",
      });
  }
};

export const updateProfileController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      username,
      full_name,
      gender,
      birth_date,
      phone_number,
      profile_base64,
    } = req.body;

    let avatarUrl = user.profiles;

    if (profile_base64) {
      const matches = profile_base64.match(
        /^data:image\/([A-Za-z-+\/]+);base64,(.+)$/,
      );
      if (!matches)
        return res
          .status(400)
          .json({ error: "Format base64 image tidak valid." });

      const fileType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const fileName = `avatar_${user.id}_${Date.now()}.${fileType === "jpeg" ? "jpg" : fileType}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, buffer, {
          contentType: `image/${fileType}`,
          upsert: true,
        });

      if (uploadError)
        throw new Error("Gagal mengupload foto profil: " + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      avatarUrl = publicUrlData.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        username: username || user.username,
        full_name: full_name || user.full_name,
        gender: gender ? gender.toUpperCase() : user.gender,
        birth_date: birth_date || user.birth_date,
        phone_number: phone_number || user.phone_number,
        profiles: avatarUrl,
      })
      .eq("id", user.id);

    if (updateError) throw new Error(updateError.message);

    return res
      .status(200)
      .json({
        success: true,
        message: "Profil berhasil diperbarui.",
        profiles: avatarUrl,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat update profil.",
      });
  }
};

export const logoutController = async (req: Request, res: Response) => {
  try {
    const token = (req as any).session_token;
    if (!token)
      return res
        .status(400)
        .json({ error: "Token sesi tidak ditemukan di server." });

    const { data, error } = await supabase
      .from("devices")
      .delete()
      .eq("session_token", token)
      .select();
    if (error)
      return res
        .status(500)
        .json({ error: "Gagal menghapus sesi dari database." });

    return res
      .status(200)
      .json({
        success: true,
        message: "Berhasil keluar dan sesi dihapus dari database.",
        deleted_data: data,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat mencoba logout.",
      });
  }
};

export const deleteUserController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { data, error } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id)
      .select();
    if (error)
      return res
        .status(500)
        .json({ error: "Gagal menghapus akun dari Supabase." });

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Akun dan seluruh sesi perangkat berhasil dihapus permanen dari sistem.",
        deleted_data: data,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat menghapus akun.",
      });
  }
};

export const checkStatusController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { data, error } = await supabase
      .from("users")
      .select("status, banned_users(reason, expires_at)")
      .eq("id", user.id)
      .single();
    if (error || !data)
      return res.status(404).json({ error: "Data pengguna tidak ditemukan." });

    return res
      .status(200)
      .json({
        success: true,
        status: data.status,
        ban_details: data.banned_users,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat mengecek status.",
      });
  }
};

export const requestOldEmailOtpController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    const otpOld = generateOTP();
    const expiredAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase
      .from("pending_email_changes")
      .delete()
      .eq("user_id", user.id);

    const { error } = await supabase.from("pending_email_changes").insert({
      user_id: user.id,
      old_email: user.email,
      new_email: "-",
      otp_old: otpOld,
      otp_new: "-",
      expires_at: expiredAt,
    });

    if (error) throw error;

    await sendOTPEmail(
      user.email,
      "Verifikasi Ganti Email LAMA",
      getResetEmailMailTemplate(user.full_name, otpOld, false),
    );
    return res
      .status(200)
      .json({
        success: true,
        message: "OTP telah dikirim ke email lama Anda.",
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Gagal memproses request OTP email lama." });
  }
};

export const verifyOldAndRequestNewEmailController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    const { otp_old, new_email } = req.body;
    const { data: request } = await supabase
      .from("pending_email_changes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (
      !request ||
      new Date() > new Date(request.expires_at) ||
      request.otp_old !== otp_old
    ) {
      return res
        .status(400)
        .json({ error: "Kode OTP lama salah atau sudah kadaluarsa." });
    }

    if (new_email === user.email)
      return res
        .status(400)
        .json({ error: "Email baru tidak boleh sama dengan email saat ini." });

    const otpNew = generateOTP();
    const { error } = await supabase
      .from("pending_email_changes")
      .update({ new_email: new_email, otp_new: otpNew })
      .eq("id", request.id);
    if (error) throw error;

    await sendOTPEmail(
      new_email,
      "Verifikasi Ganti Email BARU",
      getResetEmailMailTemplate(user.full_name, otpNew, true),
    );
    return res
      .status(200)
      .json({
        success: true,
        message: "OTP telah dikirim ke email baru Anda.",
      });
  } catch (err: any) {
    return res.status(500).json({ error: "Gagal memproses email baru." });
  }
};

export const verifyChangeEmailFinalController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    const { otp_new } = req.body;
    const { data: request } = await supabase
      .from("pending_email_changes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (
      !request ||
      new Date() > new Date(request.expires_at) ||
      request.otp_new !== otp_new
    ) {
      return res
        .status(400)
        .json({ error: "Kode OTP email baru salah atau sudah kadaluarsa." });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ email: request.new_email })
      .eq("id", user.id);
    if (updateError) throw updateError;

    await supabase
      .from("pending_email_changes")
      .delete()
      .eq("user_id", user.id);
    return res
      .status(200)
      .json({ success: true, message: "Email berhasil diperbarui." });
  } catch (err: any) {
    return res.status(500).json({ error: "Gagal memverifikasi email baru." });
  }
};

export const requestChangePasswordController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    const otpCode = generateOTP();
    const expiredAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase
      .from("pending_password_changes")
      .insert({ user_id: user.id, otp_code: otpCode, expires_at: expiredAt });
    await sendOTPEmail(
      user.email,
      "Permintaan Ganti Password",
      getForgotAccountMailTemplate(user.full_name, otpCode),
    );
    return res
      .status(200)
      .json({
        success: true,
        message: "OTP untuk ganti password telah dikirim ke email Anda.",
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Gagal memproses request ganti password." });
  }
};

export const verifyChangePasswordController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    const { otp_code, new_password } = req.body;

    const { data: request } = await supabase
      .from("pending_password_changes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (
      !request ||
      request.otp_code !== otp_code ||
      new Date() > new Date(request.expires_at)
    ) {
      return res
        .status(400)
        .json({ error: "OTP salah atau sudah kadaluarsa." });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("password")
      .eq("id", user.id)
      .single();

    if (userData && userData.password) {
      const isSamePassword = await bcrypt.compare(
        new_password,
        userData.password,
      );
      if (isSamePassword)
        return res
          .status(400)
          .json({
            error:
              "Sistem menolak: Password baru tidak boleh sama dengan password lama Anda.",
          });
    }

    const hashedNewPassword = await bcrypt.hash(new_password, 10);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password: hashedNewPassword })
      .eq("id", user.id);
    if (updateError) throw updateError;

    await supabase
      .from("pending_password_changes")
      .delete()
      .eq("user_id", user.id);
    return res
      .status(200)
      .json({ success: true, message: "Password berhasil diperbarui." });
  } catch (err: any) {
    return res.status(500).json({ error: "Gagal mengubah password." });
  }
};
