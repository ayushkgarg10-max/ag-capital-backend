import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

router.get("/today-earnings", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    // FIXED: previously computed as a balance_history diff (today's
    // balance minus yesterday's), which INCLUDES deposits/withdrawals -
    // a withdrawal looked like a big loss, a deposit looked like extra
    // profit, neither was actually true trading result. Now reads the
    // EA-reported today_realized_profit column directly (deal-history
    // based, filtered to only this EA's own trades via magic number) -
    // completely unaffected by money moved in/out of the account.
    const rows = await query(
      "select account, today_realized_profit from accounts where today_realized_profit is not null"
    );

    const earnings = {};
    let total = 0;
    for (const r of rows) {
      const earning = Number(r.today_realized_profit) || 0;
      earnings[r.account] = Number(earning.toFixed(2));
      total += earning;
    }

    res.status(200).json({ today: new Date().toISOString().slice(0, 10), earnings, total: Number(total.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ error: "Failed to compute today's earnings: " + err.toString() });
  }
});

export default router;
