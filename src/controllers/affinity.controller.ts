import { Request, Response } from "express";
import { supabase } from "../config/supabase";

const AFFINITY_LIMITS: Record<string, number> = {
  PASANGAN: 1,
  BROMANCE: 5,
  KELUARGA: 8,
  PARTNER: 5,
  SAHABAT: 5,
};

export const setAffinityController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });
    }

    const { friend_id, type } = req.body;
    if (!friend_id || !type) {
      return res
        .status(400)
        .json({ error: "ID teman dan tipe afinitas wajib diisi." });
    }

    if (!AFFINITY_LIMITS[type]) {
      return res.status(400).json({ error: "Tipe afinitas tidak valid." });
    }

    const { data: friendship, error: friendError } = await supabase
      .from("friendships")
      .select("id")
      .eq("status", "ACCEPTED")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friend_id}),and(user_id.eq.${friend_id},friend_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (friendError || !friendship) {
      return res
        .status(403)
        .json({
          error:
            "Akses ditolak. Anda hanya bisa mengatur afinitas dengan pengguna yang sudah menjadi teman resmi.",
        });
    }

    const { data: existingAffinity } = await supabase
      .from("affinities")
      .select("id, type")
      .eq("user_id", user.id)
      .eq("friend_id", friend_id)
      .maybeSingle();

    if (existingAffinity && existingAffinity.type === type) {
      return res
        .status(200)
        .json({
          success: true,
          message: `Afinitas sudah diatur sebagai ${type}.`,
        });
    }

    const { count, error: countError } = await supabase
      .from("affinities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("type", type);

    if (countError) throw countError;

    const currentCount = count || 0;
    if (currentCount >= AFFINITY_LIMITS[type]) {
      return res
        .status(400)
        .json({
          error: `Kuota untuk tipe ${type} sudah penuh (Maksimal ${AFFINITY_LIMITS[type]} slot).`,
        });
    }

    const { data: cooldown } = await supabase
      .from("affinity_cooldowns")
      .select("expires_at")
      .eq("user_id", user.id)
      .eq("friend_id", friend_id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cooldown) {
      return res.status(400).json({
        error: `Anda tidak dapat menjalin afinitas ulang dengan teman ini karena dalam masa cooldown setelah penghapusan. Sisa masa tunggu hingga: ${new Date(cooldown.expires_at).toLocaleString()}`,
      });
    }

    if (existingAffinity) {
      const { error: updateError } = await supabase
        .from("affinities")
        .update({ type, updated_at: new Date().toISOString() })
        .eq("id", existingAffinity.id);

      if (updateError) throw updateError;

      return res.status(200).json({
        success: true,
        message: `Berhasil merubah status afinitas teman menjadi ${type}.`,
      });
    } else {
      const { error: insertError } = await supabase
        .from("affinities")
        .insert({ user_id: user.id, friend_id: friend_id, type });

      if (insertError) throw insertError;

      return res.status(200).json({
        success: true,
        message: `Berhasil menambahkan afinitas sebagai ${type}.`,
      });
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat memproses afinitas.",
      });
  }
};

export const getMyAffinitiesController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });
    }

    const { data: affinities, error } = await supabase
      .from("affinities")
      .select(
        `
        id,
        type,
        created_at,
        friend:users!affinities_friend_id_fkey(id, username, full_name, gender)
      `,
      )
      .eq("user_id", user.id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Berhasil memuat daftar afinitas.",
      data: affinities,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error:
          err.message || "Internal Server Error saat memuat daftar afinitas.",
      });
  }
};

export const deleteAffinityController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });
    }

    const { id } = req.params;

    const { data: affinity, error: findError } = await supabase
      .from("affinities")
      .select("id, friend_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (findError || !affinity) {
      return res
        .status(404)
        .json({ error: "Hubungan afinitas tidak ditemukan." });
    }

    const { error: deleteError } = await supabase
      .from("affinities")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    const cooldownExpires = new Date();
    cooldownExpires.setDate(cooldownExpires.getDate() + 7);

    const { error: cooldownError } = await supabase
      .from("affinity_cooldowns")
      .insert({
        user_id: user.id,
        friend_id: affinity.friend_id,
        expires_at: cooldownExpires.toISOString(),
      });

    if (cooldownError) throw cooldownError;

    return res.status(200).json({
      success: true,
      message:
        "Afinitas berhasil dihapus. Jeda 1 minggu (cooldown) diaktifkan untuk pengguna ini agar tidak bisa melakukan afinitas ulang secara instan.",
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat menghapus afinitas.",
      });
  }
};
