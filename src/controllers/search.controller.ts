import { Request, Response } from "express";
import { supabase } from "../config/supabase";

export const searchUsersController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });
    }

    const { query } = req.query;

    if (!query || String(query).trim() === "") {
      const { data: newUsers, error: fetchError } = await supabase
        .from("users")
        .select(
          "id, email, username, full_name, phone_number, gender, birth_date, profiles, created_at",
        )
        .neq("id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      return res.status(200).json({
        success: true,
        message: "Berhasil mengambil daftar pengguna baru.",
        data: newUsers,
      });
    }

    let searchQuery = String(query).trim();

    if (searchQuery.startsWith("@")) {
      const pureUsername = searchQuery.substring(1);

      const { data: users, error } = await supabase
        .from("users")
        .select(
          "id, email, username, full_name, phone_number, gender, birth_date, profiles",
        )
        .neq("id", user.id)
        .ilike("username", pureUsername);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: "Berhasil mencari pengguna berdasarkan username.",
        data: users,
      });
    }

    const { data: users, error } = await supabase
      .from("users")
      .select(
        "id, email, username, full_name, phone_number, gender, birth_date, profiles",
      )
      .neq("id", user.id)
      .or(
        `email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`,
      );

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Berhasil mencari pengguna.",
      data: users,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Internal Server Error saat melakukan pencarian.",
    });
  }
};
