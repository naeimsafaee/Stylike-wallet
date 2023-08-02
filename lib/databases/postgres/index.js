const config = require("config").get("databases.postgres");
const { Sequelize, Op, literal } = require("sequelize");

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config.options
);

sequelize
  .authenticate()
  .then(() => {
    console.log("*** POSTGRES Info: Hi dude!");
    console.log(`*** POSTGRES Info: Please wait; Syncing database...`);
  })
  .catch((e) => {
    console.log("*** POSTGRES Error: ", e);
  });

const __address = require("./models/address");
const AddressModel = sequelize.define(
  "walletAddress",
  __address.attributes,
  __address.options
);
const __swap = require("./models/swap");
const SwapModel = sequelize.define(
  "swapTransactions",
  __swap.attributes,
  __swap.options
);

const __userTransaction = require("./models/userTransaction");
const UserTransaction = sequelize.define(
    "userTransactions",
    __userTransaction.attributes,
    __userTransaction.options
);

const __userWallet = require("./models/userWallet");
const UserWalletModel = sequelize.define(
  "userWallets",
  __userWallet.attributes,
  __userWallet.options
);
const __transactionIncoming = require("./models/transactionIncoming");
const TxInModel = sequelize.define(
  "walletIncomingTransaction",
  __transactionIncoming.attributes,
  __transactionIncoming.options
);
const __transactionOutgoing = require("./models/transactionOutgoing");
const TxOutModel = sequelize.define(
  "walletOutgoingTransaction",
  __transactionOutgoing.attributes,
  __transactionOutgoing.options
);

const __assetNetwork = require("./models/assetNetwork");
const AssetNetwork = sequelize.define(
  "assetNetwork",
  __assetNetwork.attributes,
  __assetNetwork.options
);

const __attribute = require("./models/attribute");
const Attribute = sequelize.define("attribute", __attribute.attributes, __attribute.options);

const __userAttribute = require("./models/userAttribute");
const UserAttribute = sequelize.define("userAttribute", __userAttribute.attributes, __userAttribute.options);

const __card = require("./models/card");
const Card = sequelize.define("card", __card.attributes, __card.options);


const __settings = require("./models/settings");
const Settings = sequelize.define(
    "setting",
    __settings.attributes,
    __settings.options,
);


const __asset = require("./models/asset");
const Asset = sequelize.define("asset", __asset.attributes, __asset.options);

const __cardType = require("./models/cardType");
const CardType = sequelize.define("cardTypes", __cardType.attributes, __cardType.options);

const __heatCard = require("./models/heatCard");
const HeatCard = sequelize.define("heatCard", __heatCard.attributes, __heatCard.options);

const __user = require("./models/user");
const User = sequelize.define("user", __user.attributes, __user.options);

AddressModel.hasMany(TxInModel, { foreignKey: "addressId", as: "deposits" });
TxInModel.belongsTo(AddressModel, { foreignKey: "addressId", as: "address" });

Card.hasMany(UserAttribute, { foreignKey: "cardId" });
UserAttribute.belongsTo(Card, { foreignKey: "cardId" });

Attribute.hasMany(UserAttribute, { foreignKey: "attributeId" });
UserAttribute.belongsTo(Attribute, { foreignKey: "attributeId" });

CardType.hasMany(Card, { foreignKey: "cardTypeId" });
Card.belongsTo(CardType, { foreignKey: "cardTypeId" });

const models = {
  HeatCard,
  CardType,
  AddressModel,
  TxInModel,
  TxOutModel,
  AssetNetwork,
  UserWalletModel,
  SwapModel,
  Asset,
  Attribute,
  Card,
  Settings,
  UserAttribute,
  UserTransaction,
  User
};

module.exports = { sequelize, Op, Sequelize, literal, ...models };
