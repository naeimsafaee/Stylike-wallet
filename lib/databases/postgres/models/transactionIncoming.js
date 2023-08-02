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
    from: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    to: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    attr: {
      type: DataTypes.STRING(32),
    },
    addressId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    tatumId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    txId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    blockHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    blockHeight: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  options: {
    timestamps: true,
    paranoid: true,
  },
};
