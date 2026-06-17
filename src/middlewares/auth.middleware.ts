import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

export interface AuthenticatedRequest extends Request {
  user?: any;
  session_token?: string;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      (authHeader && authHeader.split(" ")[1]) || req.cookies.session_token;

    if (!token) {
      return res
        .status(401)
        .json({ error: "Akses ditolak. Sesi tidak ditemukan." });
    }

    const { data: session, error } = await supabase
      .from("devices")
      .select("*, users(*)")
      .eq("session_token", token)
      .single();

    if (error || !session) {
      return res
        .status(401)
        .json({
          error:
            "Sesi tidak valid atau perangkat telah dikeluarkan. Silakan login kembali.",
        });
    }

    req.user = session.users;
    req.session_token = token;

    next();
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Terjadi kesalahan saat memverifikasi sesi." });
  }
};
