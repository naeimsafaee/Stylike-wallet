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
        address: {
            type: DataTypes.STRING,
        },
        name: {
            type: DataTypes.STRING(32),
        },
        mobile: {
            type: DataTypes.STRING(20),
        },
        email: {
            type: DataTypes.STRING(64),
        },
        password: {
            type: DataTypes.STRING(64),
        },
        salt: {
            type: DataTypes.STRING(64),
        },
        totp: {
            type: DataTypes.STRING(64),
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BLOCK"),
            defaultValue: "ACTIVE",
        },
        level: {
            type: DataTypes.ENUM("NORMAL", "AGENT"),
            defaultValue: "NORMAL",
        },
        levelId: {
            type: DataTypes.BIGINT,
        },
        referralCode: {
            type: DataTypes.STRING(32),
        },
        referredCode: {
            type: DataTypes.STRING(32),
            allowNull: true,
        },
        referralCodeCount: {
            type: DataTypes.INTEGER,
            default: 5,
            defaultValue: 5
        },
        pushToken: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        avatar: {
            type: DataTypes.JSONB,
            defaultValue: [],
            allowNull: true,
        },
        countryId: {
            type: DataTypes.BIGINT,
        },
        isKyc: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        max_withdraw_per_day: {
            type: DataTypes.DOUBLE,
            defaultValue: 3,
        },
    },
    options: {
        timestamps: true,
        paranoid: true,
    },
};

/*
  userLevel: {
	normal: 1,
	vip: 2,
  },
  userStatus: {
	active: 1,
	pending: 2,
	disabled: 3,
  },
*/
