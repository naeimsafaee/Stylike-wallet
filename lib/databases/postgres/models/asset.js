const {DataTypes} = require("sequelize");

module.exports = {
	attributes: {
		id: {
			type: DataTypes.BIGINT,
			primaryKey: true,
			autoIncrement: true,
			allowNull: false,
			unique: true,
		},
		coin: {
			type: DataTypes.STRING(250),
		},
		name: {
			type: DataTypes.STRING(250),
		},
		precision: {
			type: DataTypes.INTEGER,
			defaultValue: 8,
		},
		type: {
			type: DataTypes.ENUM("COIN", "TOKEN", "FIAT"),
			allowNull: false,
			defaultValue: "FIAT",
		},
		canDeposit: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		canWithdraw: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		hasTag: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		icon: {
			type: DataTypes.JSONB,
			defaultValue: [],
		},
	},
	options: {
		timestamps: true,
		paranoid: true,
	},
};

/*
  assetType: {
    coin: 1,
    token: 2,
    fiat: 3,
  },
  assetStatus: {
    active: 1,
    disable: 2,
  },
*/
