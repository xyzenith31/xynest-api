import { Request, Response } from "express";
import { snap } from "../config/midtrans";
import { sendDonationInvoice } from "../mails/donation.mail";
import { supabase } from "../config/supabase";

export const createDonation = async (req: Request, res: Response) => {
  try {
    const { amount, message } = req.body;
    const user_id = (req as any).user?.id;

    if (!user_id) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Unauthorized: User ID tidak ditemukan",
        });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    if (userError || !userData) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Akun pengguna tidak ditemukan di database",
        });
    }

    const donorName = userData.full_name || userData.name || "User";
    const email = userData.email || (req as any).user?.email || req.body.email;
    const order_id = `XYNEST-MIDTRANS-${Date.now()}`;

    const parameter = {
      transaction_details: { order_id, gross_amount: amount },
      customer_details: { first_name: donorName, email: email },
      custom_field1: message || "",
      custom_expiry: { expiry_duration: 5, unit: "minute" },
    };
    const transaction = await snap.createTransaction(parameter);

    const { error: dbError } = await supabase.from("donation_users").insert([
      {
        user_id,
        order_id,
        amount,
        message,
        status: "pending",
        full_name: donorName,
        payment_url: transaction.redirect_url,
      },
    ]);

    if (dbError) throw dbError;

    res.status(200).json({
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      order_id,
      amount,
      message,
      full_name: donorName,
      status: "pending",
    });
  } catch (error: any) {
    console.error("Error in createDonation:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Gagal membuat donasi",
        error: error?.message,
      });
  }
};

export const donationWebhook = async (req: Request, res: Response) => {
  try {
    const { order_id, transaction_status, custom_field1, gross_amount } =
      req.body;
    const email = req.body.customer_details?.email;

    let finalStatus = "pending";
    if (
      transaction_status === "capture" ||
      transaction_status === "settlement"
    ) {
      finalStatus = "success";
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "deny" ||
      transaction_status === "expire"
    ) {
      finalStatus = "failed";
    }

    if (finalStatus !== "pending") {
      await supabase
        .from("donation_users")
        .update({ status: finalStatus })
        .eq("order_id", order_id);
    }

    if (finalStatus === "success" && email) {
      await sendDonationInvoice(email, parseInt(gross_amount), custom_field1);
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ status: "error" });
  }
};

export const getDonationHistory = async (req: Request, res: Response) => {
  try {
    const user_id = (req as any).user?.id;
    const role = (req as any).user?.role;

    let query = supabase
      .from("donation_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (role !== "admin") {
      query = query.eq("user_id", user_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      const pendingDonations = data.filter((d: any) => d.status === "pending");

      for (let donation of pendingDonations) {
        try {
          const midtransStatus = await snap.transaction.status(
            donation.order_id,
          );
          const transaction_status = midtransStatus.transaction_status;

          let finalStatus = "pending";
          if (
            transaction_status === "capture" ||
            transaction_status === "settlement"
          ) {
            finalStatus = "success";
          } else if (
            transaction_status === "cancel" ||
            transaction_status === "deny" ||
            transaction_status === "expire"
          ) {
            finalStatus = "failed";
          }

          if (finalStatus !== "pending") {
            await supabase
              .from("donation_users")
              .update({ status: finalStatus })
              .eq("order_id", donation.order_id);
            donation.status = finalStatus;
          }
        } catch (midtransErr) {}
      }
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal mengambil riwayat donasi" });
  }
};

export const updateDonationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { data, error } = await supabase
      .from("donation_users")
      .update({ status })
      .eq("id", id)
      .select();
    if (error) throw error;
    res
      .status(200)
      .json({ success: true, message: "Status berhasil diubah", data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal mengubah status" });
  }
};

export const deleteDonation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from("donation_users")
      .delete()
      .eq("id", id);
    if (error) throw error;
    res
      .status(200)
      .json({ success: true, message: "Riwayat donasi berhasil dihapus" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Gagal menghapus riwayat donasi" });
  }
};
