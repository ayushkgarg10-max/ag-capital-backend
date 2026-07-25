import express from "express";
import { query } from "../lib/db.js";

const router = express.Router();

function mapRow(row) {
  return {
    account: row.account,
    status: row.status || "ACTIVE",
    command: row.command || "",
    confirmedStatus: row.confirmed_status || "",
    pnl: row.pnl,
    openPositions: row.open_positions,
    lastSeen: row.last_seen || "",
    license: row.license || "ACTIVE",
    confirmedLicense: row.confirmed_license || "",
    tradingMode: row.trading_mode || "",
    timeFilterEnabled: row.time_filter_enabled || "",
    timeFilterStart: row.time_filter_start || "",
    timeFilterEnd: row.time_filter_end || "",
    dailyProfitTarget: row.daily_profit_target || "",
    exitBlockedReason: row.exit_blocked_reason || "",
    startingBalance: row.starting_balance === null ? "" : row.starting_balance,
    startingBalanceDate: row.starting_balance_date || "",
    lastKnownBalance: row.last_known_balance === null ? "" : row.last_known_balance,
    eaVersion: row.ea_version || "",
    requestedSettings: row.requested_settings || "",
    confirmedSettings: row.confirmed_settings || "",
    buyLot: row.buy_lot === null || row.buy_lot === undefined ? 0 : Number(row.buy_lot),
    sellLot: row.sell_lot === null || row.sell_lot === undefined ? 0 : Number(row.sell_lot),
    buyPnl: row.buy_pnl === null || row.buy_pnl === undefined ? 0 : Number(row.buy_pnl),
    sellPnl: row.sell_pnl === null || row.sell_pnl === undefined ? 0 : Number(row.sell_pnl),
  };
}

router.get("/accounts", async (req, res) => {
  res.set("Cache-Control", "no-store, max-age=0");
  try {
    const rows = await query("select * from accounts");
    res.status(200).json(rows.map(mapRow));
  } catch (err) {
    res.status(500).json({ error: "Failed to load accounts: " + err.toString() });
  }
});

export default router;
