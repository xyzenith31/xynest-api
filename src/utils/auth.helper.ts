import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const generateOTP = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return otp;
};

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTPEmail = async (
  to: string,
  subject: string,
  htmlContent: string,
) => {
  const mailOptions = {
    from: `"XyNest Project" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
  };
  return transporter.sendMail(mailOptions);
};
