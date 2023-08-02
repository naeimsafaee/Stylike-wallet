const { postgres, redis } = require("./lib/databases");

(async () => {
  console.log("started pending swap transaction finder...");
  const transactions = await postgres.UserTransaction.findAll({
    where: {
      type: "SWAP",
      status: "PENDING",
    },
  });
  console.log(`${transactions.length} pending transaction finded`);
  if (transactions.length > 0) {
    console.log(
      "Please wait a few moments while adding transactions to Redis..."
    );
  }
  let inserted = 0;
  for (const tx of transactions) {
    const swapId = tx.extra.swapTxId;
    let swap = await postgres.SwapModel.findOne({
      where: {
        id: swapId,
      },
    });

    if (!swap) continue;

    let swp = {
      txId: tx.txid,
      chain: "BSC",
      userId: tx.userId,
      balanceIn: swap.balanceIn,
      assetInId: swap.assetInId,
      assetOutId: swap.assetOutId,
      amountOut: swap.amountOut,
      swapTxId: swapId,
      utxId: tx.id,
    };
    
    let redisData = await redis.client.lrange("SWAP", 0, -1);

    const exists = redisData.find((item) => {
      const json = JSON.parse(item);
      return json.utxId == swp.utxId;
    });

    if (exists) continue;

    await redis.client.rpush("SWAP", JSON.stringify(swp));
    inserted++;
  }
  if (transactions.length > 0) {
    console.log(
      `The operation ended successfully and ${inserted} transaction were inserted in Redis.`
    );
  }
})();
