const { postgres } = require("../databases");
const balance = async (userId, assetId) => {
  const wallet = await postgres.UserWalletModel.findOne({
    where: {
      assetId,
      userId,
      isLocked: false,
    },
    raw: true,
  });

  if (!wallet) {
    throw new Error("Wallet Not Found");
  }

  return wallet.amount;
};

const increaseFrozenBalance = async (userId, assetId, amount, swapTxId = 0) => {
  const t = await postgres.sequelize.transaction();
  try {
    const wallet = await postgres.UserWalletModel.findOne({
      where: {
        assetId,
        userId,
        isLocked: false,
      },
      raw: true,
      transaction: t,
    });
    if (wallet.amount < amount) {
      throw new Error("The balance of the wallet is not enough");
    }
    const update = await postgres.UserWalletModel.update(
      {
        amount: postgres.sequelize.literal(`amount - ${amount}`),
        frozen: postgres.sequelize.literal(`frozen + ${amount}`),
      },
      {
        where: {
          assetId,
          userId,
          isLocked: false,
          amount: { [postgres.Op.gte]: amount },
        },
      },
      { transaction: t }
    );
    if (swapTxId > 0) {
      await postgres.SwapModel.update(
        { status: "increase-frozen-balance" },
        { where: { id: swapTxId } },
        { transaction: t }
      );
    }
    await t.commit();
    if (update[0] == 0) {
      throw new Error("*** no update");
    }
    return true;
  } catch (error) {
    console.log(error);
    console.log("<----end increaseFrozenBalance function(error)---->");
    await t.rollback();
    return false;
  }
};

const decreaseFrozenBalance = async (
  userId,
  assetId,
  amount,
  addToAmount = false,
  swapTxId = 0
) => {
  const t = await postgres.sequelize.transaction();
  try {
    let query = { frozen: postgres.sequelize.literal(`frozen - ${amount}`) };
    if (addToAmount) {
      query["amount"] = postgres.sequelize.literal(`amount + ${amount}`);
    }
    await postgres.UserWalletModel.update(
      query,
      {
        where: {
          assetId,
          userId,
          isLocked: false,
        },
      },
      { transaction: t }
    );
    if (swapTxId > 0) {
      await postgres.SwapModel.update(
        { status: "decrease-frozen-balance" },
        { where: { id: swapTxId } },
        { transaction: t }
      );
    }
    await t.commit();
  } catch (error) {
    console.log(error);
    console.log("<----end decreaseFrozenBalance function(error)---->");
    await t.rollback();
  }
};

module.exports = {
  balance,
  increaseFrozenBalance,
  decreaseFrozenBalance,
};
