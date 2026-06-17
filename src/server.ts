import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import registerRoutes from "./routes/auth/register.routes";
import verifyRoutes from "./routes/auth/verify.routes";
import loginRoutes from "./routes/auth/login.routes";
import deviceRoutes from "./routes/auth/device.routes";
import userRoutes from "./routes/auth/user.routes";
import bannedRoutes from "./routes/admin/banned.routes";
import donationRoutes from "./routes/donation.routes";
import friendRoutes from "./routes/friend.routes";
import affinityRoutes from "./routes/affinity.routes";
import familyRoutes from "./routes/family.routes";
import searchRoutes from "./routes/search.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", registerRoutes);
app.use("/api/auth", verifyRoutes);
app.use("/api/auth", loginRoutes);
app.use("/api/auth", deviceRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/admin", bannedRoutes);
app.use("/api/donation", donationRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/affinities", affinityRoutes);
app.use("/api/family", familyRoutes);
app.use("/api/search", searchRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Server Express + TypeScript + Supabase berjalan lancar, bro!");
});

app.listen(PORT, () => {
  console.log(`⚡️ [server]: Server running di http://localhost:${PORT}`);
});
