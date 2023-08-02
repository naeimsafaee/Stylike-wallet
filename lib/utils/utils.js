function createPendingSwapKey(userId, assetId) {
  return `PENDING_SWAP_${userId}_${assetId}`;
}

function createApiCode(token, chain) {
  if (token === "STYL") return "STYL_" + chain;

  if (token === "STL") return "STL_" + chain;

  if (token === "BNB") return "BSC";

  if (token === "USDT") {
    if (chain === "ETH") return "USDT";

    if (chain === "BSC") return "USDT_BSC";
  }
}

module.exports = {
  createPendingSwapKey,
  createApiCode
};
