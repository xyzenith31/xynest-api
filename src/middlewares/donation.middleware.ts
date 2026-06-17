import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const verifyMidtransWebhook = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { order_id, status_code, gross_amount, signature_key } = req.body;
    const serverKey = process.env.MIDTRANS_SERVER_KEY || "SERVER_KEY_KAMU";

    const hash = crypto.createHash("sha512");
    hash.update(`${order_id}${status_code}${gross_amount}${serverKey}`);
    const generatedSignature = hash.digest("hex");

    if (generatedSignature !== signature_key) {
      return res.status(403).json({ message: "Invalid Midtrans Signature" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: "Middleware Error", error });
  }
};
