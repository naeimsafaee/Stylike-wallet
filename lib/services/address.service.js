const {
  redis,
  postgres: { AddressModel, TxInModel, TxOutModel, Op, AssetNetwork },
} = require("../databases");
const { pick, delay, httpStatus } = require("../utils");
const webHookDepositUrl = require("config").get("tatum.webHookDepositUrl");
const webHookWithdrawUrl = require("config").get("tatum.webHookWithdrawUrl");
const rabbitmqUrl = require("config").get("services.rabbitmq.url");
const tatum = require("@tatumio/tatum");
const axios = require("axios");
const amqplib = require("amqplib");
const rippleKeypairs = require("ripple-keypairs");
const stellarSdk = require("stellar-sdk");
const BigNumber = require("bignumber.js");
const jsdom = require("jsdom");
const { validateBody } = require("@tatumio/tatum/dist/src/connector/tatum");
const { fromWei, toWei } = require("web3-utils");
const { networks, currencies } = require("../data");
const nft = require("./nft");
const postgres = require("../databases/postgres");
const web3Utils = require("web3-utils");
const erc20Abi = require("./erc20-abi");
const Web3 = require("web3");
const bep20Abi = require("../data/bep20_abi.json");
const bscRpcUrl = require("config").get("bsc_rpc_url");
const customTokens = require("../data/token");

const { JSDOM } = jsdom;

async function read() {
  const result = [];
  const addresses = await AddressModel.findAll(
    {
      where: { index:0 },
      raw: true,
    }
  );

  for(const address of addresses){
    result.push(
      {
        currency: address.currency,
        index: 0,
        address: address.address,
        balance: +address.balance,
        value:0,
      }
    );
  }
  
  return result;
}

async function config() {
  // const hagRes = await axios.get(
  //   "https://coinmarketcap.com/currencies/hagglex?timestamp=" +
  //     new Date().getTime()
  // );
  // const dom = new JSDOM(hagRes.data);
  // const hagPrice = +dom.window.document
  //   .querySelector("div.priceValue")
  //   .innerHTML.substr(1);

  const priceRes = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price",
    {
      params: {
        ids: currencies.map((c) => c.id).join(","),
        vs_currencies: "usd",
      },
    }
  );

  const unsupported = JSON.parse(
    process.env["TATUM_TESTNET_UNSUPPORTED"] || "[]"
  );

  return currencies
    .filter((c) => !unsupported.map((u) => u.symbol).includes(c.symbol))
    .map((c) => ({
      symbol: c.symbol,
      title: c.name,
      network: networks.filter((n) => n.type == c.protocolType)[0]?.name,
      type: c.protocolType,
      balance: JSON.parse(process.env["TATUM_" + c.symbol + "_ACCOUNT"]).balance
        .accountBalance,
      value:
        // (c.symbol == "HAG" ? hagPrice : priceRes.data?.[c?.id]?.["usd"] || 0) *
        (priceRes.data?.[c?.id]?.["usd"] || 0) *
        +JSON.parse(process.env["TATUM_" + c.symbol + "_ACCOUNT"]).balance
          .accountBalance,
    }));
}

/**
 * Generate an address and save it in the db
 * @param {string} currency
 * @param {number} userId
 * @returns {Promise<{address: string, tag?: string}>}
 */
async function generateAddress({ currency, clientId = 1, userId }) {
  if (toBaseCurrency(currency) !== currency)
    await generateAddress({
      currency: toBaseCurrency(currency),
      clientId,
      userId,
    });

  //In our internal system, the stl token is known as stl_bsc, but in Tetum it is known as stlv2_bsc.
  currency = currency === "STL_BSC" ? "STLV2_BSC" : currency;

  const addresses = await AddressModel.findAll({ where: { clientId, userId } });
  const account = JSON.parse(
    process.env["TATUM_" + currency + "_ACCOUNT"] || "null"
  );
  if (!account) throw Error("CONFLICT|data not matched");
  let address = addresses.filter((addr) => addr.tatumId == account?.id)?.[0];
  if (address)
    return {
      address: address.address,
      ...(+address.attr >= 100000000 ? { tag: address.attr } : {}),
    };

  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  // check if addresses is empty then create a new index

  if (process.env.NEW_INDEX_LOCK) throw Error("CONFLICT|assign index failed");
  process.env.NEW_INDEX_LOCK = true;

  let index = addresses?.[0]?.index;

  if (!addresses.length) {
    try {
      index = (await AddressModel.max("index")) + 1;
    } catch (e) {
      throw e;
    } finally {
      delete process.env.NEW_INDEX_LOCK;
    }
  }
  address = {
    tatumId: account.id,
    currency: account.currency,
    clientId,
    userId,
    index,
  };

  try {
    if (currency == "EGLD") {
      address.address = await tatum.generateEgldAddress(
        testnet,
        process.env["TATUM_" + currency + "_MNEMONIC"],
        +index
      );
    } else {
      if (currency == "XRP") {
        const keypair = rippleKeypairs.deriveKeypair(
          process.env["TATUM_" + currency + "_SECRET"]
        );
        address.address = rippleKeypairs.deriveAddress(keypair.publicKey);
        address.attr = ~~(Math.random() * 1900000000) + 100000000;
      } else if (currency == "XLM") {
        const keypair = stellarSdk.Keypair.fromSecret(
          process.env["TATUM_" + currency + "_SECRET"]
        );
        address.address = keypair.publicKey();
        address.attr = ~~(Math.random() * 1900000000) + 100000000;
      } else {
        const wallet = await tatum.generateWallet(
          toBaseCurrency(currency),
          testnet,
          process.env["TATUM_" + currency + "_MNEMONIC"]
        );
        address.address = await tatum.generateAddressFromXPub(
          toBaseCurrency(currency),
          testnet,
          wallet.xpub,
          +index
        );
      }
    }
    if (+userId)
      await assignDepositAddressAndIndex(
        account.id,
        address.address,
        address.attr
      );
  } catch (e) {
    if (e?.response?.data?.errorCode !== "address.used") {
      console.log(address);
      console.log(e);
      delete process.env.NEW_INDEX_LOCK;
      throw Error("CONFLICT|assign address failed");
    }
  }

  try {
    //In our internal system, the stl token is known as stl_bsc, but in Tetum it is known as stlv2_bsc.
    if (address.currency === "STLV2_BSC") {
      address.currency = "STL_BSC";
    }
    address = await AddressModel.build(address).save();
  } catch (e) {
    throw e;
  } finally {
    delete process.env.NEW_INDEX_LOCK;
  }

  return {
    address: address.address,
    ...(+address.attr >= 100000000 ? { tag: address.attr } : {}),
  };
}

function toBaseCurrency(currency) {
  const chains = ["FLOW", "TRON", "ETH", "BSC", "CELO", "MATIC"];

  const base = chains.filter((chain) =>
    tatum[chain + "_BASED_CURRENCIES"].includes(currency)
  )?.[0];

  return tatum[base + "_BASED_CURRENCIES"]?.[0] || currency;
}

async function assignDepositAddressAndIndex(id, address, index) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        `https://api-eu1.tatum.io/v3/offchain/account/${id}/address/${address}` +
          (index ? `?index=${index}` : ""),
        {},
        {
          headers: {
            "x-api-key": process.env.TATUM_API_KEY,
          },
        }
      )
      .then((response) => {
        resolve(response?.data ?? {});
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function getErc20AccountBalance(chain, address, contractAddress) {
  return new Promise((resolve, reject) => {
    axios
      .get(
        `https://api-eu1.tatum.io/v3/blockchain/token/balance/${chain}/${contractAddress}/${address}`,
        {
          headers: {
            "x-api-key": process.env.TATUM_API_KEY,
          },
        }
      )
      .then((response) => {
        resolve(response?.data ?? {});
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function createIncomingTransaction(data, cron = false) {
  console.log("<===== call createIncomingTransaction =====>");
  console.log("xxxxxxx INCOMING TX: ", data);
  /*
    {
       accountId: '613d4e55330755a3e2109937',
       amount: '20',
       reference: 'ab110a4c-a15b-4272-a293-d6d27fe4c48c',
       currency: 'DOGE',
       txId: '30aa2a1be29201097ea236d43ff2349ded92aa39e719a158e41e72c8b8e1f61b',
       blockHeight: 3940523,
       blockHash: '07427ebd7e7ef8535f0c5e62dfad5c72b7b041360dca495a7738813a3515371b',
       from: null,
       to: 'DKk4ffJgUTvVdD7Trtr6weNWx69icpszZY',
       date: 1634410913627
     }
    */

  try {
    let insertObject = pick(data, [
      "from",
      "to",
      "addressId",
      "currency",
      "amount",
      "tatumId",
      "txId",
      "blockHash",
      "blockHeight",
      "date",
    ]);

    if (!cron) {
      const transactions = await tatum.getTransactionsByReference(
        data.reference
      );
      if (!transactions.length) return;
    }

    //In our internal system, the stl token is known as stl_bsc, but in Tetum it is known as stlv2_bsc.
    if (data.currency === "STLV2_BSC") {
      insertObject.currency = "STL_BSC";
      data.currency = "STL_BSC";
    }

    console.log("check transaction...");
    const checkTransaction = await TxInModel.findOne({
      where: { txId: data.txId, currency: data.currency },
      raw: true,
    });
    if (checkTransaction) {
      console.log("already exist transaction");
      return;
    }
    const address = await AddressModel.findOne({
      where: {
        ...(data.destinationTag
          ? { attr: data.destinationTag }
          : data.message
          ? { attr: data.message }
          : { address: data.to }),
        tatumId: data.accountId,
      },
      raw: true,
    });
    if (!address) {
      console.log("wallet not found!");
      return;
    }

    insertObject.addressId = address.id;
    insertObject.tatumId = data.accountId;

    const tx = await TxInModel.build(insertObject).save();

    // check transaction is fee
    console.log("check transaction is fee...");
    let isFee = await TxOutModel.findOne({
      where: { txId: data.txId, isFee: true },
    });

    if (isFee) {
      console.log("transaction is fee!");
      return;
    }

    const txCompelete = await TxInModel.findOne({
      where: { txId: tx.txId, currency: tx.currency },
      nest: true,
      include: [
        {
          model: AddressModel,
          as: "address",
          nested: true,
        },
      ],
      raw: true,
    });

    console.log("txCompelete done");

    if (address.clientId) {
      await sendToQueue(
        "incomingTransactions" +
          (address.clientId == 1 ? "" : address.clientId),
        txCompelete
      );
      console.log("published to message broker.");
    }

    await updateBalance(address);

    process.env["TATUM_" + tx.currency + "_ACCOUNT"] = JSON.stringify(
      await tatum.getAccountById(data.accountId)
    );
    console.log("<===== end createIncomingTransaction =====>");
  } catch (e) {
    console.log("====================================");
    console.log(e);
    console.log("====================================");
  } finally {
    return;
  }
}

async function subscribeOutgoing(body) {
  return new Promise((resolve, reject) => {
    axios
      .post("https://api-eu1.tatum.io/v3/subscription", body, {
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.TATUM_API_KEY,
        },
      })
      .then((response) => {
        console.log(response.data);
        resolve(response?.data ?? {});
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function subscribe() {
  await unsubscribe();

  try {
    for (const currency of currencies) {
      if (currency.subscribe == false) continue;

      const account = JSON.parse(
        process.env["TATUM_" + currency.symbol + "_ACCOUNT"] || "null"
      );
      if (!account) {
        continue;
      }

      await tatum.createNewSubscription({
        type: tatum.SubscriptionType.ACCOUNT_INCOMING_BLOCKCHAIN_TRANSACTION,
        attr: {
          id: account.id,
          url: webHookDepositUrl,
        },
      });
    }
    await subscribeOutgoing({
      type: "TRANSACTION_IN_THE_BLOCK",
      attr: {
        url: webHookWithdrawUrl,
      },
    });
  } catch (e) {
    console.log("*** TATUM Error: Subscription outgoing: ", e);
  }
  return console.log(
    "*** TATUM Info: Subscription done for " +
      currencies.length +
      " accounts/currencies."
  );
}

async function unsubscribe() {
  console.log("*** TATUM Info: Starting to unsubscribe all...");

  const subscriptions = [];
  for (let i = 0; true; i++) {
    const tmpSubs = await tatum.listActiveSubscriptions(50, 50 * i);
    if (!tmpSubs.length) break;
    subscriptions.push(...tmpSubs);
  }
  for (const subscription of subscriptions)
    await tatum.cancelExistingSubscription(subscription.id);
  return console.log(
    "*** TATUM Info: All unsubscribed! " +
      subscriptions.length +
      " old subscriptions has been removed."
  );
}

async function createOutgoingTransaction(data) {
  console.log("<==== Start createOutgoingTransaction ====>");
  let {
    currency,
    paymentId,
    amount,
    fee,
    gasPrice,
    gasLimit,
    address,
    tag,
    senderNote,
    index,
    clientId,
    type,
  } = data;
  //In our internal system, the stl token is known as stl_bsc, but in Tetum it is known as stlv2_bsc.
  if (currency === "STL_BSC") {
    currency = "STLV2_BSC";
  }
  console.log("wihdraw request:", data);
  const paymentCheck = await TxOutModel.count({
    where: { paymentId, clientId },
  });
  if (paymentCheck) throw Error("FORBIDDEN|payment already exists");
  if (!fee && !gasPrice)
    throw Error("FORBIDDRN|fee or gasPrice has zero value");
  const account = JSON.parse(
    process.env["TATUM_" + currency + "_ACCOUNT"] || "null"
  );
  if (!account) throw Error("NOT_FOUND|currency not supported");

  await withdrawAssertion(data);

  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  const currencyData = currencies.filter((c) => c.symbol == currency)?.[0];

  const networkName = networks.filter(
    (n) => n.type == currencyData.protocolType
  )?.[0].name;

  let tatumTransferObject = null;

  switch (networkName) {
    case "Litecoin":
    case "Bitcoin Cash":
    case "Dogecoin":
    case "Cardano":
    case "Bitcoin": {
      tatumTransferObject = new tatum.TransferBtcBasedOffchain();
      if (fee) tatumTransferObject.fee = `${fee}`;
      if (tag) tatumTransferObject.attr = `${tag}`;
      break;
    }
    case "XinFin":
    case "Elrond":
    case "Celo":
    case "Binance Smart Chain":
    case "Polygon":
    case "Ethereum": {
      tatumTransferObject = new tatum.TransferEthOffchain();
      tatumTransferObject.gasLimit = `${gasLimit}`;
      tatumTransferObject.gasPrice = `${gasPrice}`;
      tatumTransferObject.index = index;
      if (networkName == "Celo") tatumTransferObject.feeCurrency = currency;
      break;
    }
    case "TRON": {
      tatumTransferObject = new tatum.TransferTrxOffchain();
      tatumTransferObject.index = index;
      if (fee) tatumTransferObject.fee = `${fee}`;
      if (tag) tatumTransferObject.attr = `${tag}`;
      break;
    }
    case "Ripple": {
      const keypair = rippleKeypairs.deriveKeypair(
        process.env["TATUM_" + currency + "_SECRET"]
      );
      tatumTransferObject = new tatum.TransferXrpOffchain();
      if (fee) tatumTransferObject.fee = `${fee}`;
      if (tag) tatumTransferObject.attr = `${tag}`;
      tatumTransferObject.account = rippleKeypairs.deriveAddress(
        keypair.publicKey
      );
      tatumTransferObject.secret = process.env.TATUM_XRP_SECRET;
      break;
    }
    case "Stellar": {
      tatumTransferObject = new tatum.TransferXlmOffchain();
      if (fee) tatumTransferObject.fee = `${fee}`;
      if (tag) tatumTransferObject.attr = `${tag}`;
      tatumTransferObject.secret = process.env.TATUM_XLM_SECRET;
      break;
    }
    default:
      throw Error("NOT_FOUND|network not found");
  }
  tatumTransferObject.address = address;
  tatumTransferObject.amount = `${amount}`;
  tatumTransferObject.senderAccountId = account.id;
  if (!["XRP", "XLM", "BNB", "ALGO", "NEO"].includes(currency)) {
    tatumTransferObject.mnemonic =
      process.env["TATUM_" + currency + "_MNEMONIC"];

    const wallet = await tatum.generateWallet(
      toBaseCurrency(currency),
      testnet,
      process.env["TATUM_" + currency + "_MNEMONIC"]
    );
    tatumTransferObject.xpub = wallet?.xpub;

    // tatumTransferObject.fromPrivateKey = await tatum.generatePrivateKeyFromMnemonic(
    //   toBaseCurrency(currency),
    //   testnet,
    //   process.env["TATUM_" + currency + "_MNEMONIC"],
    //   index
    // );
  }

  if (Number(tatumTransferObject.amount) < 0) {
    tatumTransferObject.amount = (Math.abs(Number(tatumTransferObject.amount))).toString();
  }

  let tatumSignedTransaction = null;
  try {
    switch (networkName) {
      case "Bitcoin":
      case "Litecoin":
      case "Dogecoin":
      case "Bitcoin Cash":
      case "Cardano":
        tatumSignedTransaction = await sendOffchainTransaction(
          tatumTransferObject
        );
        break;
      case "Binance Smart Chain":
        tatumSignedTransaction = await tatum.sendBscOffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      case "Polygon":
        tatumSignedTransaction = await sendPolygonffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      case "Ethereum":{
        tatumTransferObject.privateKey = await tatum.generatePrivateKeyFromMnemonic(
          toBaseCurrency(currency),
          testnet,
          process.env["TATUM_" + currency + "_MNEMONIC"],
          index
        );
        tatumSignedTransaction =
        currency == "ETH"
          ? await tatum.sendEthOffchainTransaction(
              testnet,
              tatumTransferObject
            )
          : await tatum.sendEthErc20OffchainTransaction(
              testnet,
              tatumTransferObject
            );
      break;
      }
      case "TRON":
        delete tatumTransferObject.index;
        tatumTransferObject.fromPrivateKey = await tatum.generatePrivateKeyFromMnemonic(
          toBaseCurrency(currency),
          testnet,
          process.env["TATUM_" + currency + "_MNEMONIC"],
          index
        );
        tatumSignedTransaction = await tatum.sendTronOffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      case "Celo":
        tatumSignedTransaction = await tatum.sendCeloOffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      case "Ripple":
        tatumSignedTransaction = await tatum.sendXrpOffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      case "Stellar":
        tatumSignedTransaction = await tatum.sendXlmOffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      case "XinFin":
        tatumSignedTransaction = await tatum.sendXdcOffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      case "Elrond":
        tatumSignedTransaction = await tatum.sendEgldOffchainTransaction(
          testnet,
          tatumTransferObject
        );
        break;
      default:
        throw Error("NOT_FOUND|network not found");
    }
  } catch (e) {
    console.log("*** WALLET Error: sign error, ");

    throw e?.response?.data?.statusCode
      ? Error(
          require("http-status")[e?.response?.data?.statusCode + "_NAME"] +
            "|" +
            e.response.data.message
        )
      : Error(e);
  }
  console.log("*** WALLET Info: Signed tx: ", tatumSignedTransaction);
  if (!tatumSignedTransaction.id)
    throw Error("CONFLICT|transaction not signed");

  let insertObject = {
    tatumId: account.id,
    to: address,
    amount,
    currency,
    compliant: false,
    fee: fee ?? 0,
    gasPrice: gasPrice ?? 0,
    gasLimit: gasLimit ?? 0,
    paymentId,
    tatumWithdrawalId: tatumSignedTransaction.id,
    txId: tatumSignedTransaction.txId,
    index,
    clientId,
    isFee: type && type === "FEE" ? true : false,
  };
  if (tag) insertObject.attr = tag;
  if (senderNote) insertObject.senderNote = senderNote;
  //In our internal system, the stl token is known as stl_bsc, but in Tetum it is known as stlv2_bsc.
  if (insertObject.currency === "STLV2_BSC") {
    insertObject.currency = "STL_BSC";
  }
  const newTx = await TxOutModel.build(insertObject).save();
  console.log("<==== End createOutgoingTransaction ====>");
  return newTx;
}

async function withdrawAssertion(data) {
  console.log("<==== Start withdrawAssertion ====>");
  let { currency, amount, fee, gasPrice, gasLimit, index } = data;

  //In our internal system, the stl token is known as stl_bsc, but in Tetum it is known as stlv2_bsc.
  if (currency === "STL_BSC") {
    currency = "STLV2_BSC";
  }

  if (["LTC", "BTC", "BCH", "DOGE", "ADA", "XRP", "XLM"].includes(currency))
    return;

  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  const wallet = await tatum.generateWallet(
    toBaseCurrency(currency),
    testnet,
    process.env["TATUM_" + currency + "_MNEMONIC"]
  );
  const address = await tatum.generateAddressFromXPub(
    toBaseCurrency(currency),
    testnet,
    wallet.xpub,
    index
  );

  const contractAddress = tatum.CONTRACT_ADDRESSES[currency];

  const currencyData = currencies.filter((c) => c.symbol == currency)?.[0];

  const networkData = networks.filter(
    (n) => n.type == currencyData.protocolType
  )?.[0];

  let balance,
    tokenBalance,
    finalFee = new BigNumber(fee);

  switch (networkData.type) {
    case "ETH":
    case "ERC20":
      balance = new BigNumber(
        (await tatum.ethGetAccountBalance(address)).balance
      );
      finalFee = new BigNumber(gasLimit)
        .times(gasPrice)
        .div(new BigNumber(10).pow(9));
      if (contractAddress) {
        const decimals = await tatum.getErc20Decimals(
          testnet,
          "ETH",
          contractAddress
        );
        tokenBalance = new BigNumber(
          (
            await tatum.ethGetAccountErc20Address(address, contractAddress)
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      break;

    case "TRX":
    case "TRC20":
      try {
        balance = new BigNumber(
          (await tatum.tronGetAccount(address)).balance
        ).div(1000000);
      } catch (e) {
        balance = new BigNumber(0);
      }
      if (contractAddress) {
        try {
          const decimals = await tatum.getTronTrc20ContractDecimals(
            testnet,
            contractAddress
          );
          tokenBalance = new BigNumber(
            (
              await tatum.tronGetAccountTrc20Address(
                testnet,
                address,
                contractAddress
              )
            ).toString()
          ).div(new BigNumber(10).pow(decimals));
        } catch (error) {
          tokenBalance = new BigNumber(0);
        }
      }
      break;

    case "BSC":
    case "BEP20":
      balance = new BigNumber(
        (await tatum.bscGetAccountBalance(address)).balance
      );
      finalFee = new BigNumber(gasLimit)
        .times(gasPrice)
        .div(new BigNumber(10).pow(9));
      if (contractAddress) {
        const decimals = await tatum.getBscBep20ContractDecimals(
          testnet,
          contractAddress
        );
        tokenBalance = new BigNumber(
          (
            await tatum.bscGetAccountBep20Address(address, contractAddress)
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      break;

    case "MATIC":
      balance = new BigNumber(
        (await tatum.polygonGetAccountBalance(address)).balance
      );
      finalFee = new BigNumber(gasLimit)
        .times(gasPrice)
        .div(new BigNumber(10).pow(9));
      if (contractAddress) {
        const decimals = await tatum.getPolygonErc20ContractDecimals(
          testnet,
          contractAddress
        );
        tokenBalance = new BigNumber(
          (
            await getErc20AccountBalance("MATIC", address, contractAddress)
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      break;

    case "CELO":
      balance = new BigNumber(
        (await tatum.celoGetAccountBalance(address)).celo
      );
      finalFee = new BigNumber(gasLimit)
        .times(gasPrice)
        .div(new BigNumber(10).pow(9));
      if (["CUSD", "CEUR"].includes(currency)) {
        const decimals = await tatum.getCeloErc20ContractDecimals(
          testnet,
          tatum[currency + "_ADDRESS_MAINNET"]
        );
        tokenBalance = new BigNumber(
          (
            await getErc20AccountBalance(
              "CELO",
              address,
              tatum[currency + "_ADDRESS_MAINNET"]
            )
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      break;

    case "XDC":
      balance = new BigNumber(
        (await tatum.xdcGetAccountBalance(address)).balance
      );
      finalFee = new BigNumber(gasLimit)
        .times(gasPrice)
        .div(new BigNumber(10).pow(9));
      break;
    case "EGLD":
      balance = new BigNumber(
        (await tatum.egldGetAccountBalance(address)).balance
      );
      finalFee = new BigNumber(gasLimit)
        .times(gasPrice)
        .div(new BigNumber(10).pow(9));
      break;

    default:
      return;
  }

  if (
    typeof tokenBalance === "undefined" &&
    finalFee.plus(amount).isGreaterThan(balance)
  )
    throw Error(
      "NOT_FOUND|balance is low, balance: " +
        balance.toString() +
        ", finalFee: " +
        finalFee.toString() +
        ", address: " +
        address
    );
  else if (
    typeof tokenBalance !== "undefined" &&
    new BigNumber(amount).isGreaterThan(tokenBalance)
  )
    throw Error(
      "NOT_FOUND|balance is low, balance: " +
        tokenBalance.toString() +
        ", address: " +
        address
    );

  if (finalFee.isGreaterThan(balance))
    throw Error(
      "NOT_FOUND|fee is low, balance: " +
        balance.toString() +
        ", finalFee: " +
        finalFee.toString() +
        ", address: " +
        address
    );
}

async function sendOffchainTransaction({
  senderAccountId,
  address,
  amount,
  fee,
  mnemonic,
  xpub,
}) {
  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  let currency;
  let withdrawalResponse = await tatum.offchainStoreWithdrawal({
    senderAccountId,
    address,
    amount,
    fee,
  });

  let txData;

  try {
    for (const input of withdrawalResponse.data) {
      if (input.vIn === "-1") continue;
      if (!currency) currency = input.address.currency;
      input.address.xpub = xpub;
      if (!input.address.address) {
        input.address.address = tatum.generateAddressFromXPub(
          input.address.currency,
          testnet,
          xpub,
          0
        );
        input.address.derivationKey = 0;
      } else {
        const dbAddress = await AddressModel.findOne({
          where: { address: input.address.address },
          raw: true,
        });
        if (dbAddress) input.address.derivationKey = +dbAddress.index || 0;
        else
          throw Error(
            "CONFLICT|address not registered: " + input.address.address
          );
      }
    }

    const prepareFun = {
      ["BTC"]: tatum.prepareBitcoinSignedOffchainTransaction,
      ["LTC"]: tatum.prepareLitecoinSignedOffchainTransaction,
      ["DOGE"]: tatum.prepareDogecoinSignedOffchainTransaction,
      ["BCH"]: tatum.prepareBitcoinCashSignedOffchainTransaction,
      ["ADA"]: require("./ada").prepareAdaSignedOffchainTransaction,
    };

    txData = await prepareFun[currency](
      testnet,
      withdrawalResponse.data,
      amount,
      address,
      mnemonic,
      null,
      null,
      currency == "BCH" ? undefined : xpub
    );
  } catch (e) {
    await tatum.offchainCancelWithdrawal(withdrawalResponse.id);
    throw e;
  }
  let txHash;
  try {
    txHash = await tatum.offchainBroadcast({
      currency,
      txData,
      withdrawalId: withdrawalResponse.id,
    });
  } catch (e) {
    await tatum.offchainCancelWithdrawal(withdrawalResponse.id);
    throw e;
  }

  return { ...txHash, id: withdrawalResponse.id };
}

async function compeleteOutgoingTransaction(data) {
  console.log("xxxxxxx OUTGOING TX: ", data);
  if (!data.withdrawalId || !data.txId) return;
  /*
        {
           txId: 'e71544f602c52cfec8a646898bb28477e0ccc0363e4d917d1138d6a9124f0f9b',
           reference: '0b136819-7607-4de8-b561-b6ab176b5112',
           accountId: '613d4e55330755a3e2109937',
           currency: 'DOGE',
           withdrawalId: '6146e681b3ba9902aebde9a0',
           address: 'DKcBdrvEchWn2R3x7BRJgFoxyXq7TTtb8L',
           amount: '10',
           blockHeight: 3903223
        }
    */
  // await tatum.offchainCompleteWithdrawal(data.withdrawalId, data.txId);
  let tx = await TxOutModel.findOne({
    where: { tatumWithdrawalId: data.withdrawalId },
    raw: true,
  });
  // if transaction does not exist
  // or transaction has already been processed
  // then skip
  if (!tx || tx.reference) return;
  tx = await TxOutModel.update(
    {
      blockHeight: data.blockHeight,
      reference: data.reference,
      date: +new Date(),
    },
    {
      where: {
        id: tx.id,
      },
      returning: true,
    }
  );
  tx = tx[1][0];

  if (tx.clientId)
    await sendToQueue(
      "outgoingTransactions" + (tx.clientId == 1 ? "" : tx.clientId),
      tx
    );

  const address = await AddressModel.findOne({
    where: {
      tatumId: tx.tatumId,
      index: tx.index,
    },
  });

  await updateBalance(address);

  process.env["TATUM_" + tx.currency + "_ACCOUNT"] = JSON.stringify(
    await tatum.getAccountById(data.accountId)
  );
}

async function sendToQueue(queue, message) {
  const connection = await amqplib.connect(rabbitmqUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(queue);
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  setTimeout(() => {
    connection.close();
  }, 500);
}

async function webbHook(data) {
  console.log("*** WALLET Debug: Data received: ", data);
  if (data.withdrawalId) return compeleteOutgoingTransaction(data);
  else return createIncomingTransaction(data);
}

async function updateBalance(data) {
  if (!data) {
    console.log("data is null");
    return;
  }

  let account;

  const unsupported = JSON.parse(
    process.env["TATUM_TESTNET_UNSUPPORTED"] || "[]"
  );

  for (const c of currencies.filter(
    (c) => !unsupported.map((u) => u.symbol).includes(c.symbol)
  )) {
    const tmpAccount = JSON.parse(
      process.env["TATUM_" + c.symbol + "_ACCOUNT"]
    );
    if (tmpAccount.id == data.tatumId) {
      account = tmpAccount;
      break;
    }
  }

  if (!account) {
    return;
  }

  let currency = account.currency;
  if (currency === "STL_BSC") {
    currency = "STLV2_BSC";
  }

  const index = data.index;

  if (["LTC", "BTC", "BCH", "DOGE", "ADA", "XRP", "XLM"].includes(currency))
    return;

  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  const wallet = await tatum.generateWallet(
    toBaseCurrency(currency),
    testnet,
    process.env["TATUM_" + currency + "_MNEMONIC"]
  );
  const address = await tatum.generateAddressFromXPub(
    toBaseCurrency(currency),
    testnet,
    wallet.xpub,
    +index
  );

  const contractAddress = tatum.CONTRACT_ADDRESSES[currency];

  const currencyData = currencies.filter((c) => c.symbol == currency)?.[0];

  const networkData = networks.filter(
    (n) => n.type == currencyData.protocolType
  )?.[0];

  let balance, tokenBalance, chain;

  switch (networkData.type) {
    case "ETH":
    case "ERC20":
      balance = new BigNumber(
        (await tatum.ethGetAccountBalance(address)).balance
      );
      if (contractAddress) {
        const decimals = await tatum.getErc20Decimals(
          testnet,
          "ETH",
          contractAddress
        );
        tokenBalance = new BigNumber(
          (
            await tatum.ethGetAccountErc20Address(address, contractAddress)
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      chain = "ETH";
      break;

    case "TRX":
    case "TRC20":
      try {
        balance = new BigNumber(
          (await tatum.tronGetAccount(address)).balance
        ).div(1000000);
      } catch (e) {
        balance = new BigNumber(0);
      }
      if (contractAddress) {
        try {
          const decimals = await tatum.getTronTrc20ContractDecimals(
            testnet,
            contractAddress
          );
          tokenBalance = new BigNumber(
            (
              await tatum.tronGetAccountTrc20Address(
                testnet,
                address,
                contractAddress
              )
            ).toString()
          ).div(new BigNumber(10).pow(decimals));
        } catch (error) {
          tokenBalance = new BigNumber(0);
        }
      }
      chain = "TRON";
      break;

    case "BSC":
    case "BEP20":
      balance = new BigNumber(
        (await tatum.bscGetAccountBalance(address)).balance
      );
      if (contractAddress) {
        const decimals = await tatum.getBscBep20ContractDecimals(
          testnet,
          contractAddress
        );
        tokenBalance = new BigNumber(
          (
            await tatum.bscGetAccountBep20Address(address, contractAddress)
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      chain = "BSC";
      break;

    case "MATIC":
      balance = new BigNumber(
        (await tatum.polygonGetAccountBalance(address)).balance
      );
      if (contractAddress) {
        const decimals = await tatum.getPolygonErc20ContractDecimals(
          testnet,
          contractAddress
        );
        tokenBalance = new BigNumber(
          (
            await getErc20AccountBalance("MATIC", address, contractAddress)
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      chain = "MATIC";
      break;

    case "CELO":
      balance = new BigNumber(
        (await tatum.celoGetAccountBalance(address)).celo
      );
      if (["CUSD", "CEUR"].includes(currency)) {
        const decimals = await tatum.getCeloErc20ContractDecimals(
          testnet,
          tatum[currency + "_ADDRESS_MAINNET"]
        );
        tokenBalance = new BigNumber(
          (
            await getErc20AccountBalance(
              "CELO",
              address,
              tatum[currency + "_ADDRESS_MAINNET"]
            )
          ).balance
        ).div(new BigNumber(10).pow(decimals));
      }
      chain = "CELO";
      break;

    case "XDC":
      balance = new BigNumber(
        (await tatum.xdcGetAccountBalance(address)).balance
      );
      break;
    case "EGLD":
      balance = new BigNumber(
        (await tatum.egldGetAccountBalance(address)).balance
      );
      break;

    default:
      return;
  }

  if (typeof tokenBalance === "undefined") {
    await AddressModel.update(
      {
        balance: balance.toFormat({
          decimalSeparator: ".",
          groupSeparator: "",
        }),
      },
      { where: { tatumId: account.id, index } }
    );
  } else {
    const chainAccount = JSON.parse(process.env["TATUM_" + chain + "_ACCOUNT"]);
    await generateAddress({
      currency: chain,
      clientId: data.clientId,
      userId: data.userId,
    });
    await AddressModel.update(
      {
        balance: balance.toFormat({
          decimalSeparator: ".",
          groupSeparator: "",
        }),
      },
      {
        where: {
          tatumId: chainAccount.id,
          index,
        },
      }
    );
    await AddressModel.update(
      {
        balance: tokenBalance.toFormat({
          decimalSeparator: ".",
          groupSeparator: "",
        }),
      },
      {
        where: {
          tatumId: account.id,
          index,
        },
      }
    );
  }
}

async function nativeTokenfeeCalculate(from, to) {
  const web3 = new Web3(bscRpcUrl);

  const gasPrice = await web3.eth.getGasPrice();

  var gasLimit = await web3.eth.estimateGas({ from, to, gasPrice });

  return gasPrice * gasLimit;
}

async function customTokenFeeCalculate(from, to, amount, currency) {
  const token = customTokens.find((item) => item.symbol == currency);

  const web3 = new Web3(bscRpcUrl);

  const myContract = new web3.eth.Contract(bep20Abi, token.address);

  const gasPrice = await web3.eth.getGasPrice();

  const gasLimit = await myContract.methods
    .transfer(to, web3.utils.toWei(amount.toString(), "ether"))
    .estimateGas({ from, to, gasPrice });

  return gasPrice * gasLimit;
}

function feeCalculator(from, to, amount, currency) {
  if (currency == "BSC") {
    return nativeTokenfeeCalculate(from, to);
  } else {
    return customTokenFeeCalculate(from, to, amount, currency);
  }
}

/**
 * new wallet amount collector
 * @returns
 */
function newCollect() {
  return new Promise(async (resolve, reject) => {
    try {
      if (process.env.COLLECT_PENDING) {
        let res = await TxInModel.count({
          where: { txId: process.env.COLLECT_PENDING },
        });

        if (res) delete process.env.COLLECT_PENDING;
        else {
          console.log("*** COLLECT Info: Waiting for pending tx");

          return resolve();
        }
      }

      const supportedCurrencies = [
        "BSC",
        //"USDT_BSC",
        "STL_BSC",
        "STYL_BSC",
        "BUSD_BSC",
        "ETH",
        "USDT",
        "USDT_TRON",
        "TRON"
      ];

      let getWalletCondition = [];
      for (let asset of supportedCurrencies) {
        let withdrawFee = asset == "BSC" ? 0.001 : asset == "BUSD_BSC" ? 5 : 0;
        getWalletCondition.push({
          [Op.and]: {
            currency: { [Op.eq]: asset },
            balance: { [Op.gt]: withdrawFee },
          },
        });
      }

      // get one wallet for the collector
      const wallet = await AddressModel.findOne({
        where: {
          index: { [Op.ne]: 0 },
          [Op.or]: getWalletCondition,
        },
        order: [["updatedAt", "ASC"]],
      });

      if (!wallet) {
        return;
      }

      if (!wallet) return resolve();

      console.log("*** new Collect :", {
        userId: wallet.userId,
        currency: wallet.currency,
        address: wallet.address,
        balance: wallet.balance,
      });

      // determine the wallet chain
      let chain;

      if (wallet.currency == "USDT" || wallet.currency == "tUSDT" || wallet.currency == "ETH")
        chain = "ETH";
      else if (
        wallet.currency == "USDT_TRON" ||
        wallet.currency == "TRON" ||
        wallet.currency == "tUSDT_TRON"
      )
        chain = "TRON";
      //else if (wallet.currency == "USDT_MATIC" || wallet.currency == "tUSDT_MATIC") chain = "MATIC";
      else if (
        wallet.currency == "BSC" ||
        wallet.currency == "STL_BSC" ||
        wallet.currency == "STYL_BSC" ||
        wallet.currency == "BUSD_BSC" ||
        wallet.currency == "USDT_BSC"
      )
        chain = "BSC";
      else return resolve();

      // check current wallet have fee amount in native currency
      let walletNativeBalance = await checkNativeBalance(wallet.address, chain);

      let assetNetwork = await postgres.AssetNetwork.findOne({
        where: { apiCode: wallet.currency },
      });

      if (!assetNetwork) return resolve();

      // calculate fee transaction
      let fee, feeGWei;
      if (assetNetwork.feeType === "GAS") {
        fee = new BigNumber(assetNetwork.gasPrice).multipliedBy(
          new BigNumber(assetNetwork.gasLimit)
        );

        feeGWei = web3Utils.fromWei(fee.toString(), "Gwei");
      } else {
        fee = new BigNumber(assetNetwork.fee);

        feeGWei = assetNetwork.fee;
      }

      let paymentId = await TxOutModel.max("paymentId", {
        where: {
          clientId: 0,
        },
      });

      paymentId = +paymentId + 1;

      // check if wallet balance not enough for transaction fee
      if (walletNativeBalance === 0 || walletNativeBalance < +feeGWei) {
        const mainWallet = await AddressModel.findOne({
          where: { index: 0, currency: chain },
        });
        // check main wallet have enough balance
        if (!mainWallet || mainWallet?.balance < +feeGWei) {
          console.log("*** COLLECT Info: Not enough fee " + chain);

          return resolve();
        }

        // send fee to wallet
        const tx = await createOutgoingTransaction({
          currency: chain,
          paymentId,
          amount: feeGWei,
          fee: chain == "TRON"?0:assetNetwork.fee,
          gasPrice: assetNetwork.gasPrice,
          gasLimit: assetNetwork.gasLimit,
          address: wallet.address,
          index: +mainWallet.index,
          clientId: 0,
          type: "FEE",
        });

        process.env.COLLECT_PENDING = tx.txId;
      } else {
        // transfer to dead address if currency is STL
        const mainWallet = await AddressModel.findOne({
          where: { index: 0, currency: wallet.currency },
        });

        // let address = wallet.currency == "STL_BSC" ? "0x000000000000000000000000000000000000dEaD" : mainWallet.address;
        // send balance to main wallet
        const tx = await createOutgoingTransaction({
          currency: wallet.currency,
          paymentId,
          amount:
            wallet.currency === chain
              ? new BigNumber(wallet.balance)
                  .minus(new BigNumber(feeGWei))
                  .toString()
              : wallet.balance,
          fee: assetNetwork.fee,
          gasPrice: assetNetwork.gasPrice,
          gasLimit: assetNetwork.gasLimit,
          address: mainWallet.address,
          index: +wallet.index,
          clientId: 0,
        });

        process.env.COLLECT_PENDING = tx.txId;
      }
      return resolve();
    } catch (error) {
      console.log("COLLECT Error: " + error);
      return resolve();
    }
  });
}

/**
 * check account balance by adress
 * @param {*} address
 * @param {*} chain
 * @returns
 */
function checkNativeBalance(address, chain) {
  return new Promise(async (resolve, reject) => {
    let walletNativeBalance;

    try {
      if (chain === "ETH")
        walletNativeBalance = +(await tatum.ethGetAccountBalance(address))
          ?.balance;
      if (chain === "TRON")
      try {
        walletNativeBalance = +(
          (await tatum.tronGetAccount(address))?.balance / 1000000
        );
      } catch (error) {
        walletNativeBalance = 0;
      }
      if (chain === "MATIC")
        walletNativeBalance = +(await tatum.polygonGetAccountBalance(address))
          ?.balance;
      if (chain === "BSC")
        walletNativeBalance = +(await tatum.bscGetAccountBalance(address))
          ?.balance;
    } catch (error) {
      console.log(error);
      walletNativeBalance = 0;
    } finally {
      return resolve(walletNativeBalance);
    }
  });
}

async function sendPolygonffchainTransaction(testnet, body, provider) {
  await validateBody(body, tatum.TransferEthOffchain);
  const {
    mnemonic,
    index,
    privateKey,
    gasLimit,
    gasPrice,
    nonce,
    ...withdrawal
  } = body;
  const { amount, address } = withdrawal;

  const fromPriv =
    mnemonic && index !== undefined
      ? await tatum.generatePrivateKeyFromMnemonic(
          "MATIC",
          testnet,
          mnemonic,
          index
        )
      : privateKey;

  const account = await tatum.getAccountById(withdrawal.senderAccountId);
  let txData;
  const fee = {
    gasLimit: gasLimit || "21000",
    gasPrice: gasPrice || "20",
  };
  if (account.currency === "MATIC") {
    txData = await tatum.preparePolygonSignedTransaction(
      testnet,
      {
        amount,
        fromPrivateKey: fromPriv,
        currency: account.currency,
        fee,
        nonce,
        to: address,
      },
      provider
    );
  } else {
    txData = await tatum.preparePolygonTransferErc20SignedTransaction(
      testnet,
      {
        amount,
        fee,
        fromPrivateKey: fromPriv,
        to: address,
        digits: tatum.CONTRACT_DECIMALS[account.currency],
        nonce,
        contractAddress: tatum.CONTRACT_ADDRESSES[account.currency],
      },
      provider
    );
  }
  // @ts-ignore
  withdrawal.fee = fromWei(
    new BigNumber(fee.gasLimit)
      .multipliedBy(toWei(fee.gasPrice, "gwei"))
      .toString(),
    "ether"
  );
  const { id } = await tatum.offchainStoreWithdrawal(withdrawal);
  try {
    return {
      ...(await tatum.offchainBroadcast({
        txData,
        withdrawalId: id,
        currency: "MATIC",
      })),
      id,
    };
  } catch (e) {
    console.error(e);
    try {
      await tatum.offchainCancelWithdrawal(id);
    } catch (e1) {
      console.log(e);
      return { id };
    }
  }
}

async function createNft() {
  throw Error("CONFLICT|nft smart contract already created");
  try {
    const testnet = JSON.parse(process.env.TATUM_TESTNET);

    return {
      txId: await nft.createContract({
        chain: "MATIC",
        fromPrivateKey: await tatum.generatePrivateKeyFromMnemonic(
          "MATIC",
          testnet,
          process.env["TATUM_MATIC_MNEMONIC"],
          0
        ),
        name: "Volex",
        symbol: "VLX",
        testnet,
      }),
    };
  } catch (e) {
    console.log(e);

    throw Error(
      e?.message
        ? "SERVICE_UNAVAILABLE|" + e.message
        : "CONFLICT|nft smart contract failed"
    );
  }
}

async function mintNft(data) {
  try {
    const testnet = JSON.parse(process.env.TATUM_TESTNET);

    const wallet = await tatum.generateWallet(
      "MATIC",
      testnet,
      process.env["TATUM_MATIC_MNEMONIC"]
    );

    const to = await tatum.generateAddressFromXPub(
      "MATIC",
      testnet,
      wallet.xpub,
      0
    );

    return {
      txId: await nft.mint({
        chain: "MATIC",
        contractAddress: data.contractAddress,
        fromPrivateKey: await tatum.generatePrivateKeyFromMnemonic(
          "MATIC",
          testnet,
          process.env["TATUM_MATIC_MNEMONIC"],
          0
        ),
        id: data.id || data.ids,
        testnet,
        to: data.id ? to : data.ids.map(() => to),
        url: data.url || data.urls,
      }),
    };
  } catch (e) {
    console.log(e);

    throw Error(
      e?.message
        ? "SERVICE_UNAVAILABLE|" + e.message
        : "CONFLICT|nft mint failed"
    );
  }
}

async function transferNft(data) {
  try {

    console.log('Data for transfer nft:', data);

    const testnet = JSON.parse(process.env.TATUM_TESTNET);

    let from, fromPrivateKey;

    var chain = data.chain;

    if (!data.index) {
      fromPrivateKey = process.env["PRIVATE_KEY"];

      from = "0xdc4c997b592a27dc9366ffbceaa4841c7cf6ff29";
    } else {
      let currency = toBaseCurrency(chain),
        mnemonic = process.env["TATUM_"+chain+"_MNEMONIC"];

      const wallet = await tatum.generateWallet(currency, testnet, mnemonic);

      from = await tatum.generateAddressFromXPub(
        currency,
        testnet,
        wallet.xpub,
        data.index
      );

      fromPrivateKey = await tatum.generatePrivateKeyFromMnemonic(
        currency,
        testnet,
        mnemonic,
        data.index
      );
    }

    return {
      txId: await nft.transfer({
        chain,
        contractAddress: data.contractAddress,
        fromPrivateKey,
        from,
        id: data.id,
        testnet,
        to: data.to,
      }),
    };
  } catch (e) {
    console.log(e);

    throw Error(
      e?.message
        ? "SERVICE_UNAVAILABLE|" + e.message
        : "CONFLICT|nft trasnfer failed"
    );
  }
}

/**
 * mint and transfer stl token
 * @param {*} data
 * @returns
 */
function mintToken(data) {
  return new Promise(async (resolve, reject) => {
    try {
      let { address, amount } = data;

      let contractAddress = "0xaa12db4e58a7e57cb4a3b92e56620a2fd719339b";

      const testnet = JSON.parse(process.env.TATUM_TESTNET);

      const fromPrivateKey = await tatum.generatePrivateKeyFromMnemonic(
        "BSC",
        testnet,
        process.env["TATUM_BSC_MNEMONIC"],
        0
      );

      const web3 = nft.getWeb3({ chain: "BSC", fromPrivateKey, testnet });

      const contract = new web3.eth.Contract(erc20Abi, contractAddress);

      const transaction = {
        to: contractAddress,
        data: contract.methods.mint(address, amount).encodeABI(),
      };

      return resolve(
        await nft.sendTransaction({ web3, transaction, fromPrivateKey })
      );
    } catch (error) {
      console.log(error);

      return reject(
        error?.message
          ? "SERVICE_UNAVAILABLE|" + error.message
          : "CONFLICT| mint token failed"
      );
    }
  });
}

/**
 * burn stl token
 * @param {*} data
 * @returns
 */
function burnToken(data) {
  return new Promise(async (resolve, reject) => {
    try {
      let { amount } = data;

      let contractAddress = "0xaa12db4e58a7e57cb4a3b92e56620a2fd719339b";

      const testnet = JSON.parse(process.env.TATUM_TESTNET);

      const fromPrivateKey = await tatum.generatePrivateKeyFromMnemonic(
        "BSC",
        testnet,
        process.env["TATUM_BSC_MNEMONIC"],
        0
      );

      const web3 = nft.getWeb3({ chain: "BSC", fromPrivateKey, testnet });

      const contract = new web3.eth.Contract(erc20Abi, contractAddress);

      const transaction = {
        to: contractAddress,
        data: contract.methods.burn(amount).encodeABI(),
      };

      return resolve(
        await nft.sendTransaction({ web3, transaction, fromPrivateKey })
      );
    } catch (error) {
      console.log(error);

      return reject(
        error?.message
          ? "SERVICE_UNAVAILABLE|" + error.message
          : "CONFLICT| burn token failed"
      );
    }
  });
}

async function getNft(data) {
  try {
    const testnet = JSON.parse(process.env.TATUM_TESTNET);

    return data.id
      ? await getNftTokenMetadata("MATIC", data.contractAddress, data.id)
      : {
          balance: +(await nft.getBalance({
            address: data.address,
            chain: "MATIC",
            contractAddress: data.contractAddress,
            testnet,
          })),
        };
  } catch (e) {
    console.log(e);

    throw e?.response?.data?.statusCode
      ? Error(
          require("http-status")[e?.response?.data?.statusCode + "_NAME"] +
            "|" +
            e.response.data.message
        )
      : Error(
          e?.message
            ? "SERVICE_UNAVAILABLE|" + e.message
            : "CONFLICT|nft get failed"
        );
  }
}

async function getNftTokenMetadata(chain, contractAddress, token) {
  return new Promise((resolve, reject) => {
    axios
      .get(
        `https://api-eu1.tatum.io/v3/nft/metadata/${chain}/${contractAddress}/${token}`,
        {
          headers: {
            "x-api-key": process.env.TATUM_API_KEY,
          },
        }
      )
      .then((response) => {
        resolve(response?.data ?? {});
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function burnNft(data) {
  try {
    const testnet = JSON.parse(process.env.TATUM_TESTNET);

    return {
      txId: await nft.burn({
        chain: "MATIC",
        contractAddress: data.contractAddress,
        fromPrivateKey: await tatum.generatePrivateKeyFromMnemonic(
          "MATIC",
          testnet,
          process.env["TATUM_MATIC_MNEMONIC"],
          0
        ),
        id: data.id,
        testnet,
      }),
    };
  } catch (e) {
    console.log(e);

    throw Error(
      e?.message
        ? "SERVICE_UNAVAILABLE|" + e.message
        : "CONFLICT|nft burn failed"
    );
  }
}

module.exports = {
  read,
  config,
  generateAddress,
  assignDepositAddressAndIndex,
  subscribe,
  unsubscribe,
  createIncomingTransaction,
  createOutgoingTransaction,
  compeleteOutgoingTransaction,
  webbHook,
  updateBalance,
  createNft,
  mintNft,
  transferNft,
  getNft,
  burnNft,
  newCollect,
  mintToken,
  burnToken,
  toBaseCurrency,
};
