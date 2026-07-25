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

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AG Capital backend listening on port ${PORT}`);
});
