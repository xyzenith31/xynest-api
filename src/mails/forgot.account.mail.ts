export const getForgotAccountMailTemplate = (fullName: string, otpCode: string) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Permintaan Perubahan Password</h2>
      <p>Halo ${fullName},</p>
      <p>Kami menerima permintaan untuk mereset atau mengubah password akun XyNest Anda. Gunakan kode OTP berikut:</p>
      <h3 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 2px;">${otpCode}</h3>
      <p>Kode ini hanya berlaku selama 15 menit.</p>
    </div>
  `;
};