import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendDonationInvoice = async (email: string, amount: number, message: string) => {
  try {
    const mailOptions = {
      from: `"Xynest Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Invoice Donasi Berhasil - Xynest',
      html: `
        <h2>Terima kasih atas donasinya!</h2>
        <p>Pembayaran donasi kamu sebesar <b>Rp ${amount}</b> telah berhasil kami terima.</p>
        <p><b>Pesan kamu:</b> ${message}</p>
        <br/>
        <p>Salam hangat,<br/>Tim Xynest</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Invoice sent to ${email}`);
  } catch (error) {
    console.error('Gagal mengirim email invoice:', error);
  }
};