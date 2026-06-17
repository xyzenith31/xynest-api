import { Request, Response, NextFunction } from "express";

export const validateProfileUpdate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { profile_base64 } = req.body;

  if (profile_base64) {
    const matches = profile_base64.match(
      /^data:image\/([A-Za-z-+\/]+);base64,(.+)$/,
    );
    if (!matches || matches.length !== 3) {
      return res
        .status(400)
        .json({
          error: "Format foto profil tidak valid. Harus berupa base64 image.",
        });
    }

    const base64String = matches[2];
    const padding = (base64String.match(/(=*)$/) || [])[1].length;
    const sizeInBytes = base64String.length * (3 / 4) - padding;

    const maxSizeInBytes = 15 * 1024 * 1024;

    if (sizeInBytes > maxSizeInBytes) {
      return res
        .status(400)
        .json({ error: "Ukuran foto profil maksimal adalah 15MB." });
    }
  }

  next();
};
