const { DataTypes } = require("sequelize");

module.exports = {
  attributes: {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    assetInId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    assetOutId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    balanceIn: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    amountOut: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    fee: {
      type: DataTypes.DECIMAL,
      defaultValue: 0,
    },
    currentWalletInBalance: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    afterWalletInBalance: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    currentWalletInFrozen: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    afterWalletInFrozen: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    currentWalletOutBalance: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    afterWalletOutBalance: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING, //pending|completed
    },
    agent: {
      type: DataTypes.STRING,
    },
    txId: {
      type: DataTypes.STRING,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    profit: {
      type: DataTypes.DECIMAL,
      defaultValue: 0,
    },
  },
  options: {
    timestamps: true,
    paranoid: true,
  },
};
