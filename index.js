import express from "express";
import cors from "cors";

import accountsRouter from "./routes/accounts.js";
import licenseRouter from "./routes/license.js";
import toggleStatusRouter from "./routes/toggleStatus.js";
import heartbeatRouter from "./routes/heartbeat.js";
import balanceHistoryRouter from "./routes/balanceHistory.js";
import signalRouter from "./routes/signal.js";
import tvWebhookRouter from "./routes/tvWebhook.js";
import accountSettingsRouter from "./routes/accountSettings.js";
import auditLogRouter from "./routes/auditLog.js";
import todayEarningsRouter from "./routes/todayEarnings.js";
import cronCheckRouter from "./routes/cronCheck.js";
import telegramWebhookRouter from "./routes/telegramWebhook.js";

const app = express();
app.use(cors());
app.use(express.json());
// Serves /public/payment-qr.png at https://api.agcapitalfx.com/payment-qr.png -
// used by the license-expiry Telegram reminders to attach the payment QR.
app.use(express.static("public"));

// SAFETY NET: any error anywhere that isn't caught by a route's own
// try/catch would otherwise crash the ENTIRE process (killing every
// account's heartbeat mid-flight until Render auto-restarts). These
// two handlers log the error instead of letting Node.js kill the
// process - the specific request that caused it may still fail, but
// every OTHER account's requests keep working normally.
process.on("uncaughtException", (err) => {
  console.error("[FATAL - recovered] Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL - recovered] Unhandled promise rejection:", reason);
});

// Simple health-check - useful for confirming the service is alive.
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

app.use("/api", accountsRouter);
app.use("/api", licenseRouter);
app.use("/api", toggleStatusRouter);
app.use("/api", heartbeatRouter);
app.use("/api", balanceHistoryRouter);
app.use("/api", signalRouter);
app.use("/api", tvWebhookRouter);
app.use("/api", accountSettingsRouter);
app.use("/api", auditLogRouter);
app.use("/api", todayEarningsRouter);
app.use("/api", cronCheckRouter);
app.use("/api", telegramWebhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AG Capital backend listening on port ${PORT}`);
});
