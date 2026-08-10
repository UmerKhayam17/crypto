const Settings = require("../model/Settings");
const notify = require("../utils/realtimeNotify");

exports.getPublicSettings = async (_req, res) => {
  try {
    const settings = await Settings.getSettings();
    return res.json({
      ok: true,
      walletAddress: settings.trc20WalletAddress || "",
      payoutPercent: settings.payoutPercent ?? 85,
      spotFeePercent: settings.spotFeePercent ?? 0.1,
    });
  } catch (err) {
    console.error("Get public settings error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load settings" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const { trc20WalletAddress, payoutPercent, spotFeePercent } = req.body;

    if (trc20WalletAddress !== undefined) {
      settings.trc20WalletAddress = String(trc20WalletAddress).trim();
    }

    if (payoutPercent !== undefined) {
      const pct = Number(payoutPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 500) {
        return res.status(400).json({ ok: false, msg: "Payout must be between 0 and 500" });
      }
      settings.payoutPercent = pct;
    }

    if (spotFeePercent !== undefined) {
      const fee = Number(spotFeePercent);
      if (!Number.isFinite(fee) || fee < 0 || fee > 10) {
        return res.status(400).json({ ok: false, msg: "Spot fee must be between 0 and 10%" });
      }
      settings.spotFeePercent = fee;
    }

    await settings.save();

    const walletAddress = settings.trc20WalletAddress || "";
    const savedPayoutPercent = settings.payoutPercent ?? 85;
    const savedSpotFee = settings.spotFeePercent ?? 0.1;
    notify.settingsUpdated(walletAddress, savedPayoutPercent, savedSpotFee);

    return res.json({
      ok: true,
      msg: "Settings updated",
      walletAddress,
      payoutPercent: savedPayoutPercent,
      spotFeePercent: savedSpotFee,
    });
  } catch (err) {
    console.error("Update settings error:", err);
    return res.status(500).json({ ok: false, msg: "Could not update settings" });
  }
};
