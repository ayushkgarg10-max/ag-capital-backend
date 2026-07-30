import express from "express";
import { query } from "../lib/db.js";
import { notifyEvent } from "../lib/telegram.js";

const router = express.Router();

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function upsertBalanceHistory(account, balance) {
  const date = todayDateString();
  await query(
    `insert into balance_history (account, date, balance)
     values ($1,$2,$3)
     on conflict (account, date) do update set balance=$3`,
    [account, date, balance]
  );
}

router.post("/heartbeat", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const body = req.body || {};
    const expectedSecret = process.env.API_SHARED_SECRET;
    if (expectedSecret && body.secret !== expectedSecret) {
      res.status(200).json({ success: false, message: "Invalid secret" });
      return;
    }

    const account = body.account;
    if (!account) {
      res.status(200).json({ success: false, message: "Missing account" });
      return;
    }

    const existingRows = await query(
      `select account, command, starting_balance, daily_profit_target, telegram_chat_id, nickname,
              drawdown_alert_threshold, drawdown_alert_sent, daily_target_notified_date
       from accounts where account = $1`,
      [account]
    );
    if (existingRows.length === 0) {
      res.status(200).json({ success: false, message: "Account not found: " + account });
      return;
    }
    const row = existingRows[0];

    const patch = {};
    patch.last_seen = new Date().toISOString();
    if (body.confirmedStatus !== undefined) patch.confirmed_status = String(body.confirmedStatus).toUpperCase();
    if (body.pnl !== undefined) patch.pnl = Number(body.pnl);
    if (body.openPositions !== undefined) patch.open_positions = Number(body.openPositions);
    if (body.confirmedLicense !== undefined) patch.confirmed_license = String(body.confirmedLicense).toUpperCase();
    if (body.eaVersion !== undefined) patch.ea_version = String(body.eaVersion);
    if (body.confirmedSettings !== undefined) patch.confirmed_settings = String(body.confirmedSettings);
    if (body.confirmedTradingMode !== undefined) patch.confirmed_trading_mode = String(body.confirmedTradingMode).toUpperCase();
    if (body.buyLot !== undefined) patch.buy_lot = Number(body.buyLot);
    if (body.sellLot !== undefined) patch.sell_lot = Number(body.sellLot);
    if (body.buyPnl !== undefined) patch.buy_pnl = Number(body.buyPnl);
    if (body.sellPnl !== undefined) patch.sell_pnl = Number(body.sellPnl);
    // FIXED: previously "today's booked profit" was computed as a
    // balance_history diff (today's balance minus yesterday's), which
    // INCLUDES deposits/withdrawals - a withdrawal looked like a big
    // loss, a deposit looked like extra profit. The EA now reports its
    // own clean, deal-history-based number (filtered to only its own
    // trades) - store that directly instead.
    if (body.dailyRealizedProfit !== undefined) patch.today_realized_profit = Number(body.dailyRealizedProfit);

    let todaysEarning = body.dailyRealizedProfit !== undefined ? Number(body.dailyRealizedProfit) : null;
    if (body.balance !== undefined) {
      const reportedBalance = Number(body.balance);
      if (row.starting_balance === null || row.starting_balance === undefined) {
        patch.starting_balance = reportedBalance;
        patch.starting_balance_date = todayDateString();
      }
      patch.last_known_balance = reportedBalance;
      // balance_history is still recorded (useful for balance-over-time
      // charting elsewhere) - just no longer used for the daily-target
      // check below, since that number can be deposit/withdrawal-skewed.
      await upsertBalanceHistory(account, reportedBalance);
    }

    // TELEGRAM: big drawdown/loss alert
    if (body.pnl !== undefined) {
      const pnlNum = Number(body.pnl);
      const threshold =
        row.drawdown_alert_threshold === null || row.drawdown_alert_threshold === undefined
          ? -1000
          : Number(row.drawdown_alert_threshold);
      const alreadySent = !!row.drawdown_alert_sent;
      const accountLabel = row.nickname ? `${account} (${row.nickname})` : account;
      if (pnlNum <= threshold && !alreadySent) {
        patch.drawdown_alert_sent = true;
        await notifyEvent(
          row.telegram_chat_id,
          `⚠️ <b>Big Drawdown Alert</b>\nAccount: ${accountLabel}\nFloating P&L: ${pnlNum.toFixed(2)} (threshold: ${threshold})`
        );
      } else if (pnlNum > threshold / 2 && alreadySent) {
        patch.drawdown_alert_sent = false;
      }
    }

    // TELEGRAM: daily profit target hit alert
    if (todaysEarning !== null && row.daily_profit_target) {
      const target = Number(row.daily_profit_target);
      const today = todayDateString();
      if (target > 0 && todaysEarning >= target && row.daily_target_notified_date !== today) {
        patch.daily_target_notified_date = today;
        const accountLabel = row.nickname ? `${account} (${row.nickname})` : account;
        await notifyEvent(
          row.telegram_chat_id,
          `🎯 <b>Daily Profit Target Hit!</b>\nAccount: ${accountLabel}\nAaj ka booked profit: ${todaysEarning.toFixed(2)} (target: ${target})`
        );
      }
    }

    let currentCommand = row.command || "";
    const ack = body.commandAck || "";
    if (ack.endsWith("_DONE")) {
      patch.command = "";
      patch.exit_blocked_reason = "";
      currentCommand = "";
    } else if (ack.endsWith("_MARKET_CLOSED")) {
      patch.command = "";
      patch.exit_blocked_reason = "MARKET_CLOSED";
      currentCommand = "";
    }

    const keys = Object.keys(patch);
    if (keys.length > 0) {
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
      const values = keys.map((k) => patch[k]);
      await query(`update accounts set ${setClauses} where account = $1`, [account, ...values]);
    }

    res.status(200).json({
      success: true,
      message: "Heartbeat recorded for " + account,
      command: currentCommand,
    });
  } catch (err) {
    res.status(200).json({ success: false, message: "Heartbeat failed: " + err.toString() });
  }
});

export default router;
