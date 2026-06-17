import { Request, Response } from "express";
import { supabase } from "../config/supabase";

export const addFriendController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ error: "User tidak valid atau tidak terautentikasi." });
    }

    const { targetUserId } = req.body;
    const friend_id = targetUserId;

    if (!friend_id) {
      return res
        .status(400)
        .json({ error: "ID teman (targetUserId) wajib diisi." });
    }
    if (friend_id === user.id) {
      return res
        .status(400)
        .json({
          error: "Anda tidak bisa menambahkan diri sendiri sebagai teman.",
        });
    }

    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id, email, username")
      .eq("id", friend_id)
      .single();

    if (userError || !targetUser) {
      return res
        .status(404)
        .json({ error: "Pengguna yang ingin ditambahkan tidak ditemukan." });
    }

    const { data: existingFriendship, error: checkError } = await supabase
      .from("friendships")
      .select("id, status, user_id")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friend_id}),and(user_id.eq.${friend_id},friend_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (existingFriendship) {
      return res.status(400).json({
        error:
          "Hubungan pertemanan dengan pengguna ini sudah ada atau terdaftar.",
        status: existingFriendship.status,
      });
    }

    const { error: insertError } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: friend_id,
      friend_email: targetUser.email,
      friend_username: targetUser.username,
    });

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      message: "Berhasil menambahkan teman otomatis.",
    });
  } catch (err: any) {
    return res.status(500).json({
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
      return res.status(401).json({ error: "User tidak valid." });

    const { requestId, status } = req.body;
    if (!requestId || !status)
      return res
        .status(400)
        .json({ error: "Request ID dan status wajib diisi." });

    const { error: updateError } = await supabase
      .from("friendships")
      .update({ status: status })
      .eq("id", requestId);

    if (updateError) throw updateError;

    return res
      .status(200)
      .json({
        success: true,
        message: "Berhasil memperbarui status pertemanan.",
      });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getFriendsListController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res.status(401).json({ error: "User tidak valid." });

    const { data: friendships, error } = await supabase
      .from("friendships")
      .select(
        `
        id, user_id, friend_id, status, friend_email, friend_username,
        sender:users!friendships_user_id_fkey(id, username, full_name, gender, birth_date, profiles, email),
        receiver:users!friendships_friend_id_fkey(id, username, full_name, gender, birth_date, profiles, email)
      `,
      )
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (error) throw error;

    const friendsList = friendships.map((f: any) => {
      return f.user_id === user.id
        ? { ...f.receiver, friendship_id: f.id, status: f.status }
        : { ...f.sender, friendship_id: f.id, status: f.status };
    });

    return res.status(200).json({ success: true, data: friendsList });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getPendingRequestsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res.status(401).json({ error: "User tidak valid." });

    const { data: requests, error } = await supabase
      .from("friendships")
      .select(
        `
        id, created_at, status,
        sender:users!friendships_user_id_fkey(id, username, full_name, gender, birth_date, profiles, email)
      `,
      )
      .eq("friend_id", user.id)
      .eq("status", "PENDING");

    if (error) throw error;
    const pendingList = requests.map((r: any) => ({
      ...r.sender,
      friendship_id: r.id,
      status: r.status,
    }));
    return res.status(200).json({ success: true, data: pendingList });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const getFriendPreviewController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res.status(401).json({ error: "User tidak valid." });
    const { id } = req.params;

    const { data: friendData, error } = await supabase
      .from("users")
      .select("id, username, full_name, gender, birth_date, profiles, email")
      .eq("id", id)
      .single();

    if (error || !friendData)
      return res.status(404).json({ error: "Data user tidak ditemukan." });

    const { data: friendship } = await supabase
      .from("friendships")
      .select("status, user_id")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${user.id})`,
      )
      .maybeSingle();

    return res.status(200).json({
      success: true,
      data: {
        ...friendData,
        friendship_status: friendship ? friendship.status : null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const deleteFriendController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id)
      return res.status(401).json({ error: "User tidak valid." });
    const { id } = req.params;

    const { data: deletedData, error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${user.id})`,
      )
      .select();

    if (error) throw error;
    return res
      .status(200)
      .json({ success: true, message: "Pertemanan berhasil dihapus." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
