import express from "express";
import { query } from "../lib/db.js";
import { notifyEvent, sendTelegramMessage } from "../lib/telegram.js";

const router = express.Router();

const OFFLINE_THRESHOLD_MIN = 10;
const DAILY_SUMMARY_HOUR = 12;
const DAILY_SUMMARY_MINUTE = 30;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoDateString(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function runOfflineCheck() {
  const rows = await query(
    "select account, last_seen, status, telegram_chat_id, offline_alert_sent from accounts"
  );
  const now = Date.now();
  let alerted = 0,
    recovered = 0;

  await Promise.allSettled(
    rows.map(async (row) => {
      const lastSeenMs = row.last_seen ? new Date(row.last_seen).getTime() : 0;
      const minutesStale = lastSeenMs ? (now - lastSeenMs) / 60000 : Infinity;
      const isStale = minutesStale > OFFLINE_THRESHOLD_MIN;

      if (isStale && !row.offline_alert_sent) {
        await query("update accounts set offline_alert_sent = true where account = $1", [row.account]);
        await notifyEvent(
          row.telegram_chat_id,
          `🔴 <b>Account Offline</b>\nAccount: ${row.account}\nLast heartbeat: ${Math.round(minutesStale)} min pehle`
        );
        alerted++;
      } else if (!isStale && row.offline_alert_sent) {
        await query("update accounts set offline_alert_sent = false where account = $1", [row.account]);
        await notifyEvent(row.telegram_chat_id, `🟢 <b>Account Back Online</b>\nAccount: ${row.account}`);
        recovered++;
      }
    })
  );

  return { checked: rows.length, alerted, recovered };
}

async function runDailySummary() {
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
  for (const account of Object.keys(byAccount)) {
    const list = byAccount[account];
    const latest = list[0];
    earnings[account] =
      latest && latest.date === today && list.length > 1
        ? Number(latest.balance) - Number(list[1].balance)
        : 0;
  }

  const accounts = await query("select account, telegram_chat_id from accounts");

  let sentToClients = 0;
  const adminLines = [];
  await Promise.allSettled(
    accounts.map(async (a) => {
      const earning = earnings[a.account];
      if (earning === undefined) return;
      adminLines.push(`${a.account}: ${earning >= 0 ? "+" : ""}${earning.toFixed(2)}`);
      if (a.telegram_chat_id) {
        await sendTelegramMessage(
          a.telegram_chat_id,
          `📊 <b>Aaj ka Booked Profit</b>\nAccount: ${a.account}\n${earning >= 0 ? "+" : ""}${earning.toFixed(2)}`
        );
        sentToClients++;
      }
    })
  );

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId && adminLines.length > 0) {
    const chunkSize = 40;
    for (let i = 0; i < adminLines.length; i += chunkSize) {
      const chunk = adminLines.slice(i, i + chunkSize);
      await sendTelegramMessage(
        adminChatId,
        `📊 <b>Daily Summary (${i + 1}-${i + chunk.length} of ${adminLines.length})</b>\n${chunk.join("\n")}`
      );
    }
  }

  return { accountsWithEarnings: adminLines.length, sentToClients };
}

router.get("/cron-check", async (req, res) => {
  try {
    const offlineResult = await runOfflineCheck();

    const now = new Date();
    const isDailySummaryWindow =
      now.getUTCHours() === DAILY_SUMMARY_HOUR &&
      now.getUTCMinutes() >= DAILY_SUMMARY_MINUTE &&
      now.getUTCMinutes() < DAILY_SUMMARY_MINUTE + 5;

    let summaryResult = null;
    if (isDailySummaryWindow) {
      summaryResult = await runDailySummary();
    }

    res.status(200).json({ success: true, offlineCheck: offlineResult, dailySummary: summaryResult });
  } catch (err) {
    res.status(200).json({ success: false, message: "Cron check failed: " + err.toString() });
  }
});

export default router;
