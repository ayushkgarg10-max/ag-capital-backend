import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

router.get("/license", async (req, res) => {
  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const rows = await query("select * from accounts");
    const csvText = rows
      .map((row) =>
        [
          row.account,
          row.status || "ACTIVE",
          row.command || "",
          row.license || "ACTIVE",
          row.trading_mode || "",
          row.time_filter_enabled || "",
          row.time_filter_start || "",
          row.time_filter_end || "",
          row.daily_profit_target || "",
        ].join(",")
      )
      .join("\n");
    res.status(200).send(csvText);
  } catch (err) {
    res.status(200).send("");
  }
});

export default router;
