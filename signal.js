import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

router.get("/signal", async (req, res) => {
  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const symbol = req.query.symbol;
    if (!symbol) {
      res.status(200).send("NONE\n");
      return;
    }
    const rows = await query("select action, signal_id from signals where symbol = $1", [
      String(symbol).toUpperCase(),
    ]);
    if (rows.length === 0) {
      res.status(200).send("NONE\n");
      return;
    }
    const row = rows[0];
    res.status(200).send(`${row.action || "NONE"}\n${row.signal_id || ""}`);
  } catch (err) {
    res.status(200).send("NONE\n");
  }
});

export default router;
