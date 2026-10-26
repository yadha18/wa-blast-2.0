import { Router } from "express";
import { getWhatsApp } from "../whatsapp.js";

const router = Router();

router.get("/status", (req, res) => {
  const wa = getWhatsApp();
  if (!wa) return res.json({ status: "disconnected" });
  res.json(wa.getStatus());
});

router.post("/reset", async (req, res) => {
  const wa = getWhatsApp();
  if (!wa)
    return res.status(503).json({ error: "WhatsApp belum diinisialisasi" });
  wa.resetSession().catch((err) =>
    console.error("[WA] Reset sesi gagal:", err),
  );
  res.json({ ok: true });
});

router.post("/logout", async (req, res) => {
  const wa = getWhatsApp();
  if (wa) await wa.logout();
  res.json({ ok: true });
});

export default router;
