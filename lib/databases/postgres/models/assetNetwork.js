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
		networkId: {
			type: DataTypes.BIGINT,
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		withdrawFee: {
			type: DataTypes.DECIMAL,
			defaultValue: 0,
		},
		depositFee: {
			type: DataTypes.DECIMAL,
			defaultValue: 0,
		},
		fee: {
			type: DataTypes.DECIMAL,
			defaultValue: 0,
		},
		gasPrice: {
			type: DataTypes.DECIMAL,
			defaultValue: 0,
		},
		gasLimit: {
			type: DataTypes.DECIMAL,
			defaultValue: 0,
		},
		minConfirm: {
			type: DataTypes.INTEGER,
		},
		unlockConfirm: {
			type: DataTypes.INTEGER,
		},
		canDeposit: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		canWithdraw: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		withdrawMin: {
			type: DataTypes.DECIMAL,
		},
		depositMin: {
			type: DataTypes.DECIMAL,
		},
		withdrawDescription: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		depositDescription: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		specialTips: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		feeType: {
			type: DataTypes.ENUM("FEE", "GAS"),
		},
		apiCode: {
			type: DataTypes.STRING(12),
		},
	},
	options: {
		timestamps: true,
		paranoid: true,
	},
};
