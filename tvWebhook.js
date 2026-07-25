import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

router.post("/tv-webhook", async (req, res) => {
  try {
    const body = req.body || {};
    const expectedSecret = process.env.API_SHARED_SECRET;
    if (expectedSecret && body.secret !== expectedSecret) {
      res.status(200).json({ success: false, message: "Invalid secret" });
      return;
    }

    if (!body.symbol || !body.action) {
      res.status(200).json({ success: false, message: "Missing symbol or action" });
      return;
    }

    const symbol = String(body.symbol).trim().toUpperCase();
    const action = String(body.action).trim().toUpperCase();
    const signalId = body.time ? String(body.time) : String(Date.now());
    const price = body.price !== undefined ? String(body.price) : "";

    await query(
      `insert into signals (symbol, action, signal_id, price, received_at)
       values ($1,$2,$3,$4, now())
       on conflict (symbol) do update set action=$2, signal_id=$3, price=$4, received_at=now()`,
      [symbol, action, signalId, price]
    );

    res.status(200).json({ success: true, message: `Signal recorded for ${symbol}: ${action}` });
  } catch (err) {
    res.status(200).json({ success: false, message: "Error: " + err.toString() });
  }
});

export default router;
