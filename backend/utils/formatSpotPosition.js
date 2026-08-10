const normalizeId = require("./normalizeId");

function formatSpotPosition(doc) {
  const json = doc?.toJSON ? doc.toJSON() : doc;
  const side = json.side === "sell" ? "sell" : "buy";
  const entryPrice = json.entryPrice ?? (side === "buy" ? json.buyPrice : json.sellPrice) ?? 0;
  const entryFee = json.entryFee ?? (side === "buy" ? json.buyFee : json.sellFee) ?? 0;
  const exitPrice = json.exitPrice ?? (side === "buy" ? json.sellPrice : json.buyPrice);
  const exitFee = json.exitFee ?? (side === "buy" ? json.sellFee : json.buyFee);

  return {
    id: json.id || json._id?.toString(),
    userId: normalizeId(json.userId) || normalizeId(json.user?._id) || normalizeId(json.user),
    symbol: json.symbol,
    side,
    quantity: json.quantity,
    entryPrice,
    entryFee,
    cost: json.cost,
    openedAt: json.openedAt,
    status: json.status,
    exitPrice,
    exitFee,
    proceeds: json.proceeds,
    pnl: json.pnl,
    pnlPercent: json.pnlPercent,
    closedAt: json.closedAt,
    // Compatibility aliases for UI
    buyPrice: side === "buy" ? entryPrice : exitPrice,
    buyFee: side === "buy" ? entryFee : exitFee,
    sellPrice: side === "sell" ? entryPrice : exitPrice,
    sellFee: side === "sell" ? entryFee : exitFee,
  };
}

module.exports = formatSpotPosition;
