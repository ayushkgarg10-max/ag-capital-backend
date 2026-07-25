import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

function mapRow(row) {
  return {
    id: row.id,
    account: row.account,
    action: row.action,
    oldValue: row.old_value || "",
    newValue: row.new_value || "",
    actor: row.actor || "",
    createdAt: row.created_at,
  };
}

router.get("/audit-log", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const account = req.query.account;
    let rows;
    if (account) {
      rows = await query(
        "select * from audit_log where account = $1 order by created_at desc limit 200",
        [account]
      );
    } else {
      rows = await query("select * from audit_log order by created_at desc limit 200");
    }
    res.status(200).json(rows.map(mapRow));
  } catch (err) {
    res.status(500).json({ error: "Failed to load audit log: " + err.toString() });
  }
});

export default router;
