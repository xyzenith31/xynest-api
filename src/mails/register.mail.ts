export const getRegisterMailTemplate = (fullName: string, otpCode: string): string => {
  const logoUrl = 'https://lh3.googleusercontent.com/d/159mjhhIhoI8tyqS6Gk7dWT89VJUAqJKF';
  
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Akun XyNest</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: #f9fafb;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
      }
      .wrapper {
        width: 100%;
        table-layout: fixed;
        background-color: #f9fafb;
        padding: 40px 0;
      }
      .container {
        max-width: 520px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        border: 1px solid #edf2f7;
      }
      .header {
        padding: 32px 32px 20px 32px;
        text-align: center;
      }
      .logo {
        height: 48px;
        width: auto;
        display: inline-block;
      }
      .content {
        padding: 0 32px 32px 32px;
        color: #1f2937;
        line-height: 1.6;
      }
      .greeting {
        font-size: 20px;
        font-weight: 700;
        margin-top: 0;
        margin-bottom: 12px;
        color: #111827;
      }
      .text {
        font-size: 15px;
        color: #4b5563;
        margin-bottom: 24px;
      }
      .otp-box {
        background-color: #f3f4f6;
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        margin-bottom: 24px;
        border: 1px dashed #e5e7eb;
      }
      .otp-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #9ca3af;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .otp-code {
        font-size: 32px;
        font-weight: 800;
        letter-spacing: 6px;
        color: #4f46e5;
        margin: 0;
      }
      .alert-text {
        font-size: 13px;
        color: #9ca3af;
        text-align: center;
        margin-bottom: 0;
      }
      .footer {
        background-color: #fafafa;
        padding: 24px 32px;
        text-align: center;
        border-top: 1px solid #f3f4f6;
      }
      .footer-text {
        font-size: 12px;
        color: #9ca3af;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="XyNest Logo" class="logo">
        </div>
        
        <div class="content">
          <h1 class="greeting">Halo, ${fullName}! 👋</h1>
          <p class="text">Terima kasih telah bergabung di XyNest Project. Langkah terakhir untuk mengaktifkan akun kamu adalah memverifikasi alamat email ini menggunakan kode OTP di bawah ini:</p>
          
          <div class="otp-box">
            <div class="otp-label">Kode Verifikasi Pendaftaran</div>
            <h2 class="otp-code">${otpCode}</h2>
          </div>
          
          <p class="alert-text">⚠️ Kode ini hanya berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun demi keamanan akun kamu.</p>
        </div>
        
        <div class="footer">
          <p class="footer-text">&copy; 2026 XyNest Project. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
};