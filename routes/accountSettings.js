import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

router.get("/account-settings", async (req, res) => {
  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const account = req.query.account;
    if (!account) {
      res.status(200).send("");
      return;
    }
    const rows = await query("select requested_settings from accounts where account = $1", [account]);
    if (rows.length === 0) {
      res.status(200).send("");
      return;
    }
    res.status(200).send(rows[0].requested_settings || "");
  } catch (err) {
    res.status(200).send("");
  }
});

export default router;
