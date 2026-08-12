/** Profit % by binary trade duration. Loss is always 100% of stake. */
const DURATION_PROFIT_PERCENT = Object.freeze({
  30: 30,
  60: 40,
  120: 50,
  180: 60,
  240: 80,
});

const VALID_DURATIONS = Object.freeze(
  Object.keys(DURATION_PROFIT_PERCENT).map((s) => Number(s))
);

const FULL_LOSS_PERCENT = 100;

function profitPercentForDuration(durationSec) {
  const key = Number(durationSec);
  if (!Number.isFinite(key)) return null;
  const pct = DURATION_PROFIT_PERCENT[key];
  return Number.isFinite(pct) ? pct : null;
}

function isValidDuration(durationSec) {
  return VALID_DURATIONS.includes(Number(durationSec));
}

module.exports = {
  DURATION_PROFIT_PERCENT,
  VALID_DURATIONS,
  FULL_LOSS_PERCENT,
  profitPercentForDuration,
  isValidDuration,
};
