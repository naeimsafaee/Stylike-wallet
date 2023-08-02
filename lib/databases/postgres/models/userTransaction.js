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
        type: {
            type: DataTypes.ENUM("DEPOSIT", "WITHDRAW", "TRANSFER", "SWAP"),
            defaultValue: "DEPOSIT",
        },
        assetNetworkId: {
            type: DataTypes.BIGINT,
        },
        address: {
            type: DataTypes.STRING,
        },
        tag: {
            type: DataTypes.STRING,
        },
        amount: {
            type: DataTypes.DECIMAL,
        },
        previousBalance: {
            type: DataTypes.DECIMAL,
        },
        withdrawFee: {
            type: DataTypes.DECIMAL,
        },
        depositFee: {
            type: DataTypes.DECIMAL,
        },
        fee: {
            type: DataTypes.DECIMAL,
        },
        gasPrice: {
            type: DataTypes.DECIMAL,
        },
        gasLimit: {
            type: DataTypes.DECIMAL,
        },
        status: {
            type: DataTypes.ENUM("AUDITING", "PENDING", "REJECTED", "DONE"),
            defaultValue: "AUDITING",
        },
        txid: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        info: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        account: {
            type: DataTypes.ENUM("STARLEX", "ALGOTREX"),
        },
        assetId: {
            type: DataTypes.BIGINT,
        },
        index: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
        },
        from_agent_panel: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        origin: {
            type: DataTypes.ENUM("ADMIN", "SYSTEM"),
        },
        extra: {
            type: DataTypes.JSON,
            allowNull: true,
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
