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
		},
		cardId: {
			type: DataTypes.BIGINT,
		},
		attributeId: {
			type: DataTypes.BIGINT,
		},
		assetId: {
			type: DataTypes.BIGINT,
		},
		competitionLeagueId: {
			type: DataTypes.BIGINT,
		},
		competitionTaskId: {
			type: DataTypes.BIGINT,
		},
		boxTradeId: {
			type: DataTypes.BIGINT,
		},
		userLensId: {
			type: DataTypes.BIGINT,
		},
		amount: {
			type: DataTypes.DECIMAL,
			defaultValue: 0,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		type: {
			type: DataTypes.ENUM("INITIAL", "FEE", "REWARD", "BOX"),
			defaultValue: "INITIAL",
		},
	},
	options: {
		timestamps: true,
		paranoid: true,
	},
};
