import { Request, Response } from "express";
import { supabase } from "../config/supabase";

export const createFamilyController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, description, avatar_base64, role } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Nama grup keluarga wajib diisi." });
    }

    let avatarUrl = null;

    if (avatar_base64) {
      const matches = avatar_base64.match(
        /^data:image\/([A-Za-z-+\/]+);base64,(.+)$/,
      );
      if (!matches) {
        return res
          .status(400)
          .json({ error: "Format base64 image tidak valid." });
      }

      const fileType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const fileName = `family_${user.id}_${Date.now()}.${fileType === "jpeg" ? "jpg" : fileType}`;

      const { error: uploadError } = await supabase.storage
        .from("family_avatars")
        .upload(fileName, buffer, {
          contentType: `image/${fileType}`,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          "Gagal mengupload avatar keluarga: " + uploadError.message,
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from("family_avatars")
        .getPublicUrl(fileName);
      avatarUrl = publicUrlData.publicUrl;
    }

    const { data: familyData, error: familyError } = await supabase
      .from("families")
      .insert({
        name,
        description,
        avatar_url: avatarUrl,
        head_of_family_id: user.id,
      })
      .select()
      .single();

    if (familyError || !familyData) throw familyError;

    const { error: memberError } = await supabase
      .from("family_members")
      .insert({
        family_id: familyData.id,
        user_id: user.id,
        role: role || "AYAH",
        status: "ACCEPTED",
        is_head: true,
      });

    if (memberError) throw memberError;

    return res.status(201).json({
      success: true,
      message:
        "Grup keluarga berhasil dibuat dan Anda menjadi Kepala Keluarga.",
      data: familyData,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Internal Server Error saat membuat grup keluarga.",
    });
  }
};

export const updateFamilyController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { familyId } = req.params;
    const { name, description, avatar_base64 } = req.body;
    const { data: family, error: checkError } = await supabase
      .from("families")
      .select("name, description, head_of_family_id, avatar_url")
      .eq("id", familyId)
      .single();

    if (checkError || !family) {
      return res.status(404).json({ error: "Grup keluarga tidak ditemukan." });
    }

    if (family.head_of_family_id !== user.id) {
      return res
        .status(403)
        .json({
          error:
            "Akses ditolak. Hanya Kepala Keluarga yang boleh merubah data grup.",
        });
    }

    let avatarUrl = family.avatar_url;

    if (avatar_base64) {
      const matches = avatar_base64.match(
        /^data:image\/([A-Za-z-+\/]+);base64,(.+)$/,
      );
      if (matches) {
        const fileType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        const fileName = `family_${familyId}_${Date.now()}.${fileType === "jpeg" ? "jpg" : fileType}`;

        await supabase.storage.from("family_avatars").upload(fileName, buffer, {
          contentType: `image/${fileType}`,
          upsert: true,
        });

        const { data: publicUrlData } = supabase.storage
          .from("family_avatars")
          .getPublicUrl(fileName);
        avatarUrl = publicUrlData.publicUrl;
      }
    }

    const { error: updateError } = await supabase
      .from("families")
      .update({
        name: name || family.name,
        description: description || family.description,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", familyId);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: "Informasi grup keluarga berhasil diperbarui.",
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat mengedit grup.",
      });
  }
};

export const inviteMemberController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { familyId } = req.params;
    const { target_user_id, role } = req.body;

    const { data: family } = await supabase
      .from("families")
      .select("head_of_family_id")
      .eq("id", familyId)
      .single();
    if (!family || family.head_of_family_id !== user.id) {
      return res
        .status(403)
        .json({
          error:
            "Akses ditolak. Hanya Kepala Keluarga yang boleh mengundang anggota.",
        });
    }

    const { data: existing } = await supabase
      .from("family_members")
      .select("status")
      .eq("family_id", familyId)
      .eq("user_id", target_user_id)
      .single();

    if (existing) {
      return res
        .status(400)
        .json({
          error: `Pengguna tersebut sudah berstatus undangan: ${existing.status}`,
        });
    }

    const { error: inviteError } = await supabase
      .from("family_members")
      .insert({
        family_id: familyId,
        user_id: target_user_id,
        role: role || "ANGGOTA",
        status: "PENDING",
        is_head: false,
      });

    if (inviteError) throw inviteError;

    return res.status(200).json({
      success: true,
      message: "Undangan bergabung keluarga berhasil dikirim.",
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat mengundang anggota.",
      });
  }
};

export const respondInvitationController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    const { memberTableId } = req.params;
    const { action } = req.body;

    if (!["ACCEPTED", "DENIED"].includes(action)) {
      return res
        .status(400)
        .json({ error: "Aksi tidak valid. Harus 'ACCEPTED' atau 'DENIED'." });
    }

    const { data: membership, error: fetchError } = await supabase
      .from("family_members")
      .select("*")
      .eq("id", memberTableId)
      .single();

    if (fetchError || !membership) {
      return res.status(404).json({ error: "Data undangan tidak ditemukan." });
    }

    if (membership.user_id !== user.id) {
      return res
        .status(403)
        .json({
          error: "Akses ditolak. Anda tidak berhak merespon undangan ini.",
        });
    }

    if (membership.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: "Undangan ini sudah direspon sebelumnya." });
    }

    const { error: updateError } = await supabase
      .from("family_members")
      .update({
        status: action,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberTableId);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: `Anda berhasil ${action === "ACCEPTED" ? "menerima" : "menolak"} undangan keluarga.`,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat memproses undangan.",
      });
  }
};

export const updateMemberRoleController = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (req as any).user;
    const { familyId, targetUserId } = req.params;
    const { new_role } = req.body;

    const { data: family } = await supabase
      .from("families")
      .select("head_of_family_id")
      .eq("id", familyId)
      .single();
    if (!family || family.head_of_family_id !== user.id) {
      return res
        .status(403)
        .json({
          error:
            "Akses ditolak. Hanya Kepala Keluarga yang boleh mengedit role.",
        });
    }

    const { error: updateError } = await supabase
      .from("family_members")
      .update({
        role: new_role,
        updated_at: new Date().toISOString(),
      })
      .eq("family_id", familyId)
      .eq("user_id", targetUserId);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: "Role anggota keluarga berhasil diubah.",
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat mengubah role.",
      });
  }
};

export const removeMemberController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { familyId, targetUserId } = req.params;

    if (user.id === targetUserId) {
      return res
        .status(400)
        .json({
          error: "Gunakan fitur keluar grup untuk mengeluarkan diri sendiri.",
        });
    }

    const { data: family } = await supabase
      .from("families")
      .select("head_of_family_id")
      .eq("id", familyId)
      .single();
    if (!family || family.head_of_family_id !== user.id) {
      return res
        .status(403)
        .json({
          error:
            "Akses ditolak. Hanya Kepala Keluarga yang boleh mengeluarkan anggota.",
        });
    }

    const { error: deleteError } = await supabase
      .from("family_members")
      .delete()
      .eq("family_id", familyId)
      .eq("user_id", targetUserId);

    if (deleteError) throw deleteError;

    return res.status(200).json({
      success: true,
      message: "Anggota keluarga berhasil dikeluarkan dari grup.",
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error:
          err.message || "Internal Server Error saat mengeluarkan anggota.",
      });
  }
};

export const leaveFamilyController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { familyId } = req.params;
    const { next_head_user_id } = req.body;

    const { data: family, error: familyErr } = await supabase
      .from("families")
      .select("head_of_family_id")
      .eq("id", familyId)
      .single();

    if (familyErr || !family) {
      return res.status(404).json({ error: "Grup keluarga tidak ditemukan." });
    }

    const isHead = family.head_of_family_id === user.id;

    if (isHead) {
      if (!next_head_user_id) {
        return res.status(400).json({
          error:
            "Sebagai Kepala Keluarga, Anda wajib memilih satu anggota pengganti sebelum keluar grup.",
        });
      }

      const { data: memberCheck } = await supabase
        .from("family_members")
        .select("status")
        .eq("family_id", familyId)
        .eq("user_id", next_head_user_id)
        .single();

      if (!memberCheck || memberCheck.status !== "ACCEPTED") {
        return res
          .status(400)
          .json({
            error:
              "Calon kepala keluarga baru harus merupakan anggota aktif (ACCEPTED).",
          });
      }

      const { error: updateFamilyErr } = await supabase
        .from("families")
        .update({ head_of_family_id: next_head_user_id })
        .eq("id", familyId);

      if (updateFamilyErr) throw updateFamilyErr;

      await supabase
        .from("family_members")
        .update({ is_head: true })
        .eq("family_id", familyId)
        .eq("user_id", next_head_user_id);
    }

    const { error: leaveError } = await supabase
      .from("family_members")
      .delete()
      .eq("family_id", familyId)
      .eq("user_id", user.id);

    if (leaveError) throw leaveError;

    return res.status(200).json({
      success: true,
      message: isHead
        ? "Berhasil menyerahkan jabatan Kepala Keluarga dan keluar dari grup."
        : "Berhasil keluar dari grup keluarga.",
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({
        error: err.message || "Internal Server Error saat mencoba keluar grup.",
      });
  }
};
