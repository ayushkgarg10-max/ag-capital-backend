// File location: lib/telegram.js
//
// Same as before - Telegram Bot API helper. No changes needed from the
// Vercel version since this only uses plain fetch(), no platform-
// specific dependencies.
//
// REQUIRED environment variables:
//   TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_CHAT_ID

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function notifyEvent(accountTelegramChatId, text) {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  await Promise.allSettled([
    adminChatId ? sendTelegramMessage(adminChatId, text) : Promise.resolve(),
    accountTelegramChatId ? sendTelegramMessage(accountTelegramChatId, text) : Promise.resolve(),
  ]);
}
