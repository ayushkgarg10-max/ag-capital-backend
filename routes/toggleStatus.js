import express from "express";
import { query } from "../lib/db.js";
import { notifyEvent } from "../lib/telegram.js";

const router = express.Router();

async function logAudit(account, action, oldValue, newValue, actor) {
  try {
    await query(
      `insert into audit_log (account, action, old_value, new_value, actor) values ($1,$2,$3,$4,$5)`,
      [
        String(account),
        action,
        oldValue === undefined || oldValue === null ? "" : String(oldValue),
        newValue === undefined || newValue === null ? "" : String(newValue),
        actor ? String(actor) : "",
      ]
    );
  } catch (err) {
    // Audit log failure kabhi bhi asal update ko block nahi karni chahiye.
  }
}

router.post("/toggle-status", async (req, res) => {
  try {
    const {
      account,
      status,
      command,
      license,
      create,
      actor,
      tradingMode,
      timeFilterEnabled,
      timeFilterStart,
      timeFilterEnd,
      dailyProfitTarget,
      advancedSettings,
      telegramChatId,
    } = req.body || {};

    const hasAnyField =
      status !== undefined ||
      command !== undefined ||
      license !== undefined ||
      create !== undefined ||
      tradingMode !== undefined ||
      timeFilterEnabled !== undefined ||
      timeFilterStart !== undefined ||
      timeFilterEnd !== undefined ||
      dailyProfitTarget !== undefined ||
      advancedSettings !== undefined ||
      telegramChatId !== undefined;

    if (!account || !hasAnyField) {
      res.status(400).json({ success: false, message: "Missing account, and at least one field to update" });
      return;
    }

    const existingRows = await query(
      `select account, status, command, license, trading_mode, time_filter_enabled, time_filter_start,
              time_filter_end, daily_profit_target, requested_settings, telegram_chat_id
       from accounts where account = $1`,
      [account]
    );

    if (existingRows.length === 0) {
      if (create === true) {
        await query(
          `insert into accounts (account, status, license) values ($1,$2,$3)
           on conflict (account) do update set status=$2, license=$3`,
          [
            String(account),
            status !== undefined ? String(status).toUpperCase() : "ACTIVE",
            license !== undefined ? String(license).toUpperCase() : "ACTIVE",
          ]
        );
        res.status(200).json({ success: true, message: "Created new row for account " + account });
        return;
      }
      res.status(200).json({ success: false, message: "Account not found: " + account });
      return;
    }

    const current = existingRows[0];
    const patch = {};
    const auditEntries = [];

    if (status !== undefined) {
      const newStatus = String(status).trim().toUpperCase();
      if (newStatus !== "ACTIVE" && newStatus !== "PAUSED") {
        res.status(200).json({ success: false, message: "Status must be ACTIVE or PAUSED" });
        return;
      }
      if (newStatus !== (current.status || "")) {
        patch.status = newStatus;
        auditEntries.push({ action: "status", oldValue: current.status, newValue: newStatus });
      }
    }

    if (command !== undefined) {
      const newCommand = String(command).trim().toUpperCase();
      if (newCommand !== "" && newCommand !== "CLOSE_ALL" && newCommand !== "CLOSE_BUY" && newCommand !== "CLOSE_SELL") {
        res.status(200).json({ success: false, message: "Command must be blank, CLOSE_ALL, CLOSE_BUY, or CLOSE_SELL" });
        return;
      }
      if (newCommand !== (current.command || "")) {
        patch.command = newCommand;
        auditEntries.push({ action: "command", oldValue: current.command, newValue: newCommand });
      }
    }

    if (license !== undefined) {
      const newLicense = String(license).trim().toUpperCase();
      if (newLicense !== "ACTIVE" && newLicense !== "SUSPENDED") {
        res.status(200).json({ success: false, message: "License must be ACTIVE or SUSPENDED" });
        return;
      }
      if (newLicense !== (current.license || "")) {
        patch.license = newLicense;
        auditEntries.push({ action: "license", oldValue: current.license, newValue: newLicense });
      }
    }

    if (tradingMode !== undefined) {
      const newMode = String(tradingMode).trim().toUpperCase();
      const validModes = ["", "NORMAL", "BUY_ONLY", "SELL_ONLY", "REVERSE", "DUAL_BOTH"];
      if (validModes.indexOf(newMode) === -1) {
        res.status(200).json({
          success: false,
          message: "tradingMode must be blank, NORMAL, BUY_ONLY, SELL_ONLY, REVERSE, or DUAL_BOTH",
        });
        return;
      }
      if (newMode !== (current.trading_mode || "")) {
        patch.trading_mode = newMode;
        auditEntries.push({ action: "tradingMode", oldValue: current.trading_mode, newValue: newMode });
      }
    }

    if (timeFilterEnabled !== undefined) {
      const newTfe = String(timeFilterEnabled).trim().toUpperCase();
      if (newTfe !== "" && newTfe !== "TRUE" && newTfe !== "FALSE") {
        res.status(200).json({ success: false, message: "timeFilterEnabled must be blank, TRUE, or FALSE" });
        return;
      }
      if (newTfe !== (current.time_filter_enabled || "")) {
        patch.time_filter_enabled = newTfe;
        auditEntries.push({ action: "timeFilterEnabled", oldValue: current.time_filter_enabled, newValue: newTfe });
      }
    }

    if (timeFilterStart !== undefined) {
      const newTfs = String(timeFilterStart).trim();
      if (newTfs !== "" && !/^\d{1,2}:\d{2}$/.test(newTfs)) {
        res.status(200).json({ success: false, message: "timeFilterStart must be blank or HH:MM" });
        return;
      }
      if (newTfs !== (current.time_filter_start || "")) {
        patch.time_filter_start = newTfs;
        auditEntries.push({ action: "timeFilterStart", oldValue: current.time_filter_start, newValue: newTfs });
      }
    }

    if (timeFilterEnd !== undefined) {
      const newTfEnd = String(timeFilterEnd).trim();
      if (newTfEnd !== "" && !/^\d{1,2}:\d{2}$/.test(newTfEnd)) {
        res.status(200).json({ success: false, message: "timeFilterEnd must be blank or HH:MM" });
        return;
      }
      if (newTfEnd !== (current.time_filter_end || "")) {
        patch.time_filter_end = newTfEnd;
        auditEntries.push({ action: "timeFilterEnd", oldValue: current.time_filter_end, newValue: newTfEnd });
      }
    }

    if (dailyProfitTarget !== undefined) {
      const newDpt = String(dailyProfitTarget).trim();
      if (newDpt !== "" && isNaN(Number(newDpt))) {
        res.status(200).json({ success: false, message: "dailyProfitTarget must be blank or a number" });
        return;
      }
      if (newDpt !== (current.daily_profit_target || "")) {
        patch.daily_profit_target = newDpt;
        auditEntries.push({ action: "dailyProfitTarget", oldValue: current.daily_profit_target, newValue: newDpt });
      }
    }

    if (telegramChatId !== undefined) {
      const newChatId = String(telegramChatId).trim();
      if (newChatId !== (current.telegram_chat_id || "")) {
        patch.telegram_chat_id = newChatId;
        auditEntries.push({ action: "telegramChatId", oldValue: current.telegram_chat_id, newValue: newChatId });
      }
    }

    if (advancedSettings !== undefined) {
      const a = advancedSettings || {};
      const dirSource = String(a.directionSource || "EMA").trim().toUpperCase();
      if (dirSource !== "EMA" && dirSource !== "SUPERTREND") {
        res.status(200).json({ success: false, message: "advancedSettings.directionSource must be EMA or SUPERTREND" });
        return;
      }
      const layers = Array.isArray(a.layers) ? a.layers : [];
      if (layers.length !== 10) {
        res.status(200).json({
          success: false,
          message: "advancedSettings.layers must be an array of exactly 10 {drawdown,distance} entries",
        });
        return;
      }
      const fields = [
        dirSource,
        a.hullConfirmationEnabled ? "true" : "false",
        String(Number(a.martingaleMultiplier) || 0),
        String(Number(a.martingaleDistancePoints) || 0),
        a.layeringEnabled ? "true" : "false",
      ];
      for (const layer of layers) {
        fields.push(String(Number(layer.drawdown) || 0));
        fields.push(String(Number(layer.distance) || 0));
      }
      const newSettingsStr = fields.join("|");
      if (newSettingsStr !== (current.requested_settings || "")) {
        patch.requested_settings = newSettingsStr;
        auditEntries.push({ action: "advancedSettings", oldValue: current.requested_settings, newValue: newSettingsStr });
      }
    }

    if (Object.keys(patch).length === 0) {
      res.status(200).json({ success: false, message: "Nothing to update - provide at least one field" });
      return;
    }

    const keys = Object.keys(patch);
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = keys.map((k) => patch[k]);
    await query(`update accounts set ${setClauses} where account = $1`, [account, ...values]);

    // TELEGRAM: License change ka notification.
    if (patch.license !== undefined) {
      const chatId = patch.telegram_chat_id !== undefined ? patch.telegram_chat_id : current.telegram_chat_id;
      await notifyEvent(
        chatId,
        `🔐 <b>License ${patch.license}</b>\nAccount: ${account}\n(pehle: ${current.license || "—"})`
      );
    }

    await Promise.allSettled(auditEntries.map((e) => logAudit(account, e.action, e.oldValue, e.newValue, actor)));

    res.status(200).json({ success: true, message: "Updated account " + account });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error: " + err.toString() });
  }
});

export default router;
