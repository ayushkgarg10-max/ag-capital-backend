// File location: routes/telegramWebhook.js
//
// Telegram calls THIS endpoint automatically whenever anyone sends a
// message to our bot (once the webhook is registered - see the
// one-time setWebhook step in the deployment notes). We don't need to
// poll Telegram for messages - Telegram pushes them to us.
//
// Right now this only handles one thing: if someone sends /start (or
// really any message), reply with their own Chat ID so they can copy
// it and give it to the admin - no need for a third-party bot like
// @userinfobot anymore.

import express from "express";
import { sendTelegramMessage } from "../lib/telegram.js";

const router = express.Router();

router.post("/telegram-webhook", async (req, res) => {
  // Always respond 200 quickly regardless of what happens inside -
  // Telegram will retry (and eventually give up on) webhooks that
  // don't get a fast 200, so we never want this endpoint to hang or
  // error out visibly to Telegram.
  try {
    const message = req.body && req.body.message;
    const chatId = message && message.chat && message.chat.id;
    if (chatId) {
      const firstName = (message.chat.first_name || message.from?.first_name || "").trim();
      await sendTelegramMessage(
        chatId,
        `👋 Namaste${firstName ? " " + firstName : ""}!\n\n` +
          `Aapka Telegram Chat ID hai:\n<code>${chatId}</code>\n\n` +
          `Isay copy karke AG Capital admin ko de dijiye - wo isay aapke account(s) se link kar denge, ` +
          `uske baad aapko yahin trading alerts (drawdown, daily target, license status, waghera) milte rahenge.`
      );
    }
  } catch (err) {
    // Never let a webhook-handling error surface to Telegram as a
    // failure - just swallow it, this isn't critical-path for trading.
  }
  res.status(200).json({ ok: true });
});

export default router;
