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
    assetId: {
      type: DataTypes.BIGINT,
    },
    userId: {
      type: DataTypes.BIGINT,
    },
    amount: {
      type: DataTypes.DECIMAL,
      defaultValue: 0,
    },
    frozen: {
      type: DataTypes.DECIMAL,
      defaultValue: 0,
    },
    pending: {
      type: DataTypes.DECIMAL,
      defaultValue: 0,
    },
    isLocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  options: {
    timestamps: true,
    paranoid: true,
  },
};
