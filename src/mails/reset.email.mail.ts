export const getResetEmailMailTemplate = (fullName: string, otpCode: string, isNewEmail: boolean) => {
  const context = isNewEmail ? "email BARU" : "email LAMA";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Verifikasi Perubahan Email</h2>
      <p>Halo ${fullName},</p>
      <p>Anda sedang mencoba mengubah alamat email Anda. Ini adalah kode verifikasi untuk <b>${context}</b> Anda:</p>
      <h3 style="background: #eef4ff; padding: 10px; display: inline-block; letter-spacing: 2px;">${otpCode}</h3>
      <p>Masukkan kode ini di aplikasi. Kode berlaku selama 15 menit.</p>
    </div>
  `;
};