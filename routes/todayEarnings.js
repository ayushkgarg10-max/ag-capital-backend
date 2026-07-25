import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoDateString(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

router.get("/today-earnings", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const today = todayDateString();
    const since = daysAgoDateString(7);

    const rows = await query(
      "select account, date, balance from balance_history where date >= $1 order by account asc, date desc",
      [since]
    );

    const byAccount = {};
    for (const r of rows) {
      const dateStr = r.date.toISOString().slice(0, 10);
      if (!byAccount[r.account]) byAccount[r.account] = [];
      byAccount[r.account].push({ date: dateStr, balance: r.balance });
    }

    const earnings = {};
    let total = 0;
    for (const account of Object.keys(byAccount)) {
      const list = byAccount[account];
      const latest = list[0];
      let earning = 0;
      if (latest && latest.date === today && list.length > 1) {
        earning = Number(latest.balance) - Number(list[1].balance);
      }
      earnings[account] = Number(earning.toFixed(2));
      total += earning;
    }

    res.status(200).json({ today, earnings, total: Number(total.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ error: "Failed to compute today's earnings: " + err.toString() });
  }
});

export default router;
