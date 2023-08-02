const { redis, postgres } = require("../lib/databases");
const Web3 = require("web3");

const bscWeb3 = new Web3(
  `https://api-eu1.tatum.io/v3/blockchain/node/BSC/${process.env.TATUM_API_KEY}`
);
const ethWeb3 = new Web3(
  `https://api-eu1.tatum.io/v3/blockchain/node/ETH/${process.env.TATUM_API_KEY}`
);

let processingStatus = false;

const swapTransactionHandler = async () => {
  if (processingStatus) return;

  processingStatus = true;

  let items = await redis.client.lrange("SWAP", 0, -1);

  for (let item of items) {
    try {
      item = JSON.parse(item);

      let provider = item.chain === "ETH" ? ethWeb3 : bscWeb3;

      let receipt = await provider.eth.getTransactionReceipt(item.txId);

      if (!receipt || !receipt?.status) continue;

      const verify = await verifySwap(item);
      if (!verify) continue;

      await redis.client.lrem("SWAP", 0, JSON.stringify(item));
    } catch (error) {
      console.log("transaction Cron Error: ", error);
      continue;
    }
  }

  processingStatus = false;

  return;
};

async function verifySwap(item) {
  const t = await postgres.sequelize.transaction();
  try {
    const tr = await postgres.UserTransaction.findOne({
      where: {
        id: item.utxId,
        status: "PENDING",
      },
    });
    if (!tr) {
      await t.rollback();
      return true;
    }

    await postgres.UserWalletModel.update(
      { amount: postgres.sequelize.literal(`amount + ${item.amountOut}`) },
      {
        where: {
          assetId: item.assetOutId,
          userId: item.userId,
          isLocked: false,
        },
      },
      { transaction: t }
    );

    await postgres.UserWalletModel.update(
      {
        frozen: postgres.sequelize.literal(`frozen - ${item.balanceIn}`),
      },
      {
        where: {
          assetId: item.assetInId,
          userId: item.userId,
          isLocked: false,
        },
      },
      { transaction: t }
    );

    const userWallets = await postgres.UserWalletModel.findAll({
      where: {
        userId: item.userId,
        assetId: { [postgres.Op.in]: [item.assetInId, item.assetOutId] },
      },
      raw: true,
      transaction: t,
    });

    let fromWallet = userWallets.find((w) => w.assetId == item.assetInId);
    let toWallet = userWallets.find((w) => w.assetId == item.assetOutId);

    if (!fromWallet) {
      throw new Error("WalletIn Not Found");
    }
    if (!toWallet) {
      throw new Error("WalletOut Not Found");
    }

    await postgres.SwapModel.update(
      {
        afterWalletInBalance: fromWallet.amount,
        afterWalletInFrozen: fromWallet.frozen,
        afterWalletOutBalance: toWallet.amount,
        updatedAt: new Date(),
        status: "completed",
      },
      {
        where: {
          id: item.swapTxId,
        },
        transaction: t,
      }
    );

    await postgres.UserTransaction.update(
      { status: "DONE" },
      {
        where: {
          id: item.utxId,
        },
      },
      { transaction: t }
    );

    await t.commit();
    return true;
  } catch (error) {
    await t.rollback();
    console.log("** verifySwap error:", error);
    return false;
  }
}

module.exports = { swapTransactionHandler };
