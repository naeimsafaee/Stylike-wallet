const { DataTypes } = require("sequelize");

module.exports = {
  attributes: {
    //* On sending data
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      unique: true,
    },
    tatumId: {
      type: DataTypes.STRING(24),
      allowNull: false,
    },
    to: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    attr: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    compliant: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fee: {
      type: DataTypes.DECIMAL,
      allowNull: true,
      defaultValue: 0,
    },
    gasLimit: {
      type: DataTypes.DECIMAL,
      allowNull: true,
      defaultValue: 0,
    },
    gasPrice: {
      type: DataTypes.DECIMAL,
      allowNull: true,
      defaultValue: 0,
    },
    feeCurrency: {
      type: DataTypes.STRING(10),
    },
    paymentId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    senderNote: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    tatumWithdrawalId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    index: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    clientId: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    isFee: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    //* From hook
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    txId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    blockHeight: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  options: {
    timestamps: true,
    paranoid: true,
  },
};
