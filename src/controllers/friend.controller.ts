import { Request, Response } from "express";
import { supabase } from "../config/supabase";

export const searchFriendsController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { query } = req.query;
    if (!query)
      return res
        .status(400)
        .json({ error: "Query pencarian tidak boleh kosong." });

    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, full_name, gender, birth_date")
      .neq("id", user.id)
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`);

    if (error) throw error;

    return res
      .status(200)
      .json({
        success: true,
        message: "Berhasil mencari pengguna.",
        data: users,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat mencari teman.",
      });
  }
};

export const addFriendController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { friend_id } = req.body;
    if (!friend_id)
      return res.status(400).json({ error: "ID teman wajib diisi." });
    if (friend_id === user.id)
      return res
        .status(400)
        .json({
          error: "Anda tidak bisa menambahkan diri sendiri sebagai teman.",
        });

    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", friend_id)
      .single();

    if (userError || !targetUser)
      return res
        .status(404)
        .json({ error: "Pengguna yang ingin ditambahkan tidak ditemukan." });

    const { data: existingFriendship, error: checkError } = await supabase
      .from("friendships")
      .select("id, status, user_id")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friend_id}),and(user_id.eq.${friend_id},friend_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (existingFriendship) {
      if (existingFriendship.status === "ACCEPTED") {
        return res
          .status(400)
          .json({ error: "Anda sudah berteman dengan pengguna ini." });
      }
      if (existingFriendship.status === "PENDING") {
        return res
          .status(400)
          .json({
            error:
              "Permintaan pertemanan sudah dikirim sebelumnya dan sedang tertunda.",
          });
      }
      if (existingFriendship.status === "DENIED") {
        const { error: updateError } = await supabase
          .from("friendships")
          .update({ user_id: user.id, friend_id: friend_id, status: "PENDING" })
          .eq("id", existingFriendship.id);

        if (updateError) throw updateError;
        return res
          .status(200)
          .json({
            success: true,
            message: "Permintaan pertemanan berhasil dikirim kembali.",
          });
      }
    }

    const { error: insertError } = await supabase
      .from("friendships")
      .insert({ user_id: user.id, friend_id: friend_id, status: "PENDING" });

    if (insertError) throw insertError;

    return res
      .status(200)
      .json({
        success: true,
        message: "Permintaan pertemanan berhasil dikirim.",
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat menambahkan teman.",
      });
  }
};

export const respondFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { requester_id, action } = req.body;
    if (!requester_id || !action)
      return res
        .status(400)
        .json({ error: "Requester ID dan Action wajib diisi." });

    if (action !== "ACCEPTED" && action !== "DENIED") {
      return res
        .status(400)
        .json({ error: "Action tidak valid. Harus 'ACCEPTED' atau 'DENIED'." });
    }

    const { data: friendship, error: checkError } = await supabase
      .from("friendships")
      .select("id")
      .eq("user_id", requester_id)
      .eq("friend_id", user.id)
      .eq("status", "PENDING")
      .maybeSingle();

    if (checkError || !friendship) {
      return res
        .status(404)
        .json({
          error:
            "Permintaan pertemanan pending tidak ditemukan atau Anda tidak berwenang meresponsnya.",
        });
    }

    const { error: updateError } = await supabase
      .from("friendships")
      .update({ status: action })
      .eq("id", friendship.id);

    if (updateError) throw updateError;

    const message =
      action === "ACCEPTED"
        ? "Permintaan pertemanan diterima."
        : "Permintaan pertemanan ditolak.";
    return res.status(200).json({ success: true, message });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error:
          err.message ||
          "Internal Server Error saat merespons permintaan teman.",
      });
  }
};

export const getFriendsListController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { data: friendships, error } = await supabase
      .from("friendships")
      .select(
        `
        id,
        user_id,
        friend_id,
        sender:users!friendships_user_id_fkey(id, username, full_name, gender, birth_date),
        receiver:users!friendships_friend_id_fkey(id, username, full_name, gender, birth_date)
      `,
      )
      .eq("status", "ACCEPTED")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (error) throw error;

    const friendsList = friendships.map((f: any) => {
      return f.user_id === user.id ? f.receiver : f.sender;
    });

    return res
      .status(200)
      .json({
        success: true,
        message: "Berhasil mengambil daftar teman.",
        data: friendsList,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat memuat daftar teman.",
      });
  }
};

export const getPendingRequestsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { data: requests, error } = await supabase
      .from("friendships")
      .select(
        `
        id,
        created_at,
        sender:users!friendships_user_id_fkey(id, username, full_name, gender, birth_date)
      `,
      )
      .eq("friend_id", user.id)
      .eq("status", "PENDING");

    if (error) throw error;

    const pendingList = requests.map((r: any) => r.sender);

    return res
      .status(200)
      .json({
        success: true,
        message: "Berhasil mengambil permintaan pertemanan tertunda.",
        data: pendingList,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error:
          err.message ||
          "Internal Server Error saat memuat data permintaan pertemanan.",
      });
  }
};

export const getFriendPreviewController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { id } = req.params;

    const { data: isFriend, error: checkError } = await supabase
      .from("friendships")
      .select("id")
      .eq("status", "ACCEPTED")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (checkError || !isFriend)
      return res
        .status(403)
        .json({
          error:
            "Akses ditolak. Anda belum berteman resmi dengan pengguna ini.",
        });

    const { data: friendData, error } = await supabase
      .from("users")
      .select("username, full_name, gender, birth_date")
      .eq("id", id)
      .single();

    if (error || !friendData)
      return res.status(404).json({ error: "Data teman tidak ditemukan." });

    return res
      .status(200)
      .json({
        success: true,
        message: "Berhasil memuat preview teman.",
        data: friendData,
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error:
          err.message || "Internal Server Error saat memuat preview teman.",
      });
  }
};

export const deleteFriendController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });

    const { id } = req.params;

    const { data: deletedData, error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${user.id})`,
      )
      .select();

    if (error) throw error;
    if (!deletedData || deletedData.length === 0)
      return res
        .status(404)
        .json({ error: "Hubungan pertemanan tidak ditemukan." });

    return res
      .status(200)
      .json({
        success: true,
        message: "Hubungan/permintaan pertemanan berhasil dihapus.",
      });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat menghapus teman.",
      });
  }
};
