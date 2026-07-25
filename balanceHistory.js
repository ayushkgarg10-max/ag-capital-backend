import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

router.get("/balance-history", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const account = req.query.account;
    if (!account) {
      res.status(400).json({ error: "Missing account query param" });
      return;
    }
    const rows = await query(
      "select date, balance from balance_history where account = $1 order by date asc",
      [account]
    );
    res.status(200).json({
      account,
      history: rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        balance: Number(r.balance),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch balance history: " + err.toString() });
  }
});

export default router;
