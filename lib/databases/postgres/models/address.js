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
    tatumId: {
      type: DataTypes.STRING(24),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(24),
    },
    clientId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    index: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // XRP, XLM, BNB
    attr: {
      type: DataTypes.STRING(32),
    },
    balance: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
    },
  },
  options: {
    timestamps: true,
    paranoid: true,
  },
};
