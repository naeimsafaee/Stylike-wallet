const data = require("../../../data");
const tatum = require("@tatumio/tatum");
const axios = require("axios");
const { AddressModel } = require("..");

const {
  addressService: { assignDepositAddressAndIndex },
} = require("../../../services");

module.exports = async () => {
  // Tatum's bug
  process.env.TRON_PRO_API_KEY = "";
  Number.prototype.toNumber = function() {
    return +this;
  };

  if (!process.env.TATUM_API_KEY)
    throw Error("TATUM_API_KEY environment should be set");

  if (!process.env.TATUM_MNEMONIC)
    throw Error("TATUM_MNEMONIC environment should be set");

  if (!process.env.TATUM_XRP_SECRET)
    throw Error("TATUM_XRP_SECRET environment should be set");

  if (!process.env.TATUM_XLM_SECRET)
    throw Error("TATUM_XLM_SECRET environment should be set");

  const accounts = [];
  for (let i = 0; true; i++) {
    const tmpAccs = await getAllAccounts({ page: i });
    if (!tmpAccs.length) break;
    accounts.push(...tmpAccs);
  }

  process.env.TATUM_TESTNET = JSON.stringify((await getApiVersion()).testnet);

  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  tatum.FLOW_BASED_CURRENCIES = ["FLOW", "FUSD"];
  tatum.TRON_BASED_CURRENCIES = ["TRON", "USDT_TRON", "INRT_TRON"];

  for (const token of data.tokens) {
    if (
      (!testnet || token.symbol[0] != "t") &&
      (testnet || token.symbol[0] == "t")
    )
      continue;
    tatum.CONTRACT_ADDRESSES[token.symbol] = token.address;
    tatum.CONTRACT_DECIMALS[token.symbol] = token.decimals;
    tatum[token.chain + "_BASED_CURRENCIES"].push(token.symbol);
    if (!accounts.filter((a) => a.currency == token.symbol).length)
      await registerToken(token);
  }

  for (const currency of data.currencies
    .map((currency) => currency.symbol)
    .filter((currency) => !["XRP", "XLM"].includes(currency))) {
    if (!process.env["TATUM_" + currency + "_MNEMONIC"]) {
      for (const BASED_CURRENCIES of [
        ["BTC"],
        ["LTC"],
        ["DOGE"],
        ["BCH"],
        ["ADA"],
        ["XDC"],
        ["EGLD"],
        ["QTUM"],
        ["LYRA"],
        ["VET"],
        ["ONE"],
        tatum.FLOW_BASED_CURRENCIES,
        tatum.TRON_BASED_CURRENCIES,
        tatum.ETH_BASED_CURRENCIES,
        tatum.BSC_BASED_CURRENCIES,
        tatum.CELO_BASED_CURRENCIES,
        tatum.MATIC_BASED_CURRENCIES,
      ]) {
        if (BASED_CURRENCIES.includes(currency))
          process.env["TATUM_" + currency + "_MNEMONIC"] =
            process.env["TATUM_" + BASED_CURRENCIES[0] + "_MNEMONIC"] ||
            process.env.TATUM_MNEMONIC;
      }
    }
  }

  accounts.splice(0, accounts.length);
  for (let i = 0; true; i++) {
    const tmpAccs = await getAllAccounts({ page: i });
    if (!tmpAccs.length) break;
    accounts.push(...tmpAccs);
  }

  for (const currency of data.currencies) {
    try {
      let account = accounts.filter(
        (a) => a.currency == currency.symbol && !a.xpub
      )?.[0];
      if (!account) {
        account = await tatum.createAccount({
          currency: currency.symbol,
        });

        accounts.push(account);
      }
      process.env["TATUM_" + currency.symbol + "_ACCOUNT"] = JSON.stringify(
        account
      );
    } catch (e) {
      if (
        e?.response?.data?.errorCode == "account.blockchain.testnet" ||
        e?.response?.data?.message ==
          "Unable to create account, unsupported testnet blockchain." ||
        e?.response?.data?.message ==
          "Unable to create an account, unsupported currency."
      ) {
        const unsupported = JSON.parse(
          process.env["TATUM_TESTNET_UNSUPPORTED"] || "[]"
        );

        unsupported.push(currency);

        process.env["TATUM_TESTNET_UNSUPPORTED"] = JSON.stringify(unsupported);
      } else {
        console.log(e);
        console.log(e?.response?.data);
      }
    }
  }

  await generateMainAccountAddresses(accounts);

  return console.log("*** POSTGRES Info: Initializing DONE!");
};

async function setTokenContractAddress(name, address, chain) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        `https://api-eu1.tatum.io/v3/offchain/${
          chain == "TRON" ? "tron/trc" : "token"
        }/${name}/${address}`,
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

async function registerNewTokenInTheLedger({
  chain,
  symbol,
  decimals,
  description,
  address,
}) {
  return new Promise((resolve, reject) => {
    axios
      .post(
        `https://api-eu1.tatum.io/v3/offchain/token/${chain}`,
        {
          symbol,
          supply: "0",
          decimals,
          description,
          basePair: "USDT",
          accountingCurrency: "EUR",
          address,
        },
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

async function getApiVersion() {
  return new Promise((resolve, reject) => {
    axios
      .get(`https://api-eu1.tatum.io/v3/tatum/version`, {
        headers: {
          "x-api-key": process.env.TATUM_API_KEY,
        },
      })
      .then((response) => {
        resolve(response?.data ?? {});
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function registerToken({
  symbol,
  description,
  decimals,
  chain,
  type,
  address,
}) {
  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  const tmpWallet = await tatum.generateWallet(chain, testnet);

  const tmpAddress = await tatum.generateAddressFromXPub(
    chain,
    testnet,
    tmpWallet.xpub,
    1
  );

  const account =
    chain == "ETH"
      ? await tatum.registerEthereumErc20({
          symbol,
          description,
          supply: "0",
          decimals,
          basePair: "USDT",
          accountingCurrency: "EUR",
          address: tmpAddress,
        })
      : chain == "TRON"
      ? await tatum.registerTronTrc({
          type,
          symbol,
          description,
          supply: "0",
          decimals,
          basePair: "USDT",
          accountingCurrency: "EUR",
          address: tmpAddress,
        })
      : chain == "BSC"
      ? await registerNewTokenInTheLedger({
          chain: "BSC",
          decimals,
          description,
          symbol,
          address: tmpAddress,
        })
      : chain == "MATIC"
      ? await registerNewTokenInTheLedger({
          chain: "MATIC",
          decimals,
          description,
          symbol,
          address: tmpAddress,
        })
      : null;

  await tatum.removeDepositAddress(account.accountId, account.address);

  await setTokenContractAddress(symbol, address, chain);
}

async function getAllAccounts({ pageSize = 50, page = 0 }) {
  return new Promise((resolve, reject) => {
    axios
      .get(
        `https://api-eu1.tatum.io/v3/ledger/account?pageSize=${pageSize}&page=${page}`,
        {
          headers: {
            "x-api-key": process.env.TATUM_API_KEY,
          },
        }
      )
      .then((response) => {
        resolve(response?.data ?? []);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function generateMainAccountAddresses(accounts) {
  const testnet = JSON.parse(process.env.TATUM_TESTNET);

  // loop through currencies
  for (const account of accounts.filter((a) =>
    [
      "ETH",
      "TRON",
      "BSC",
      "MATIC",
      "USDT",
      "USDT_TRON",
      "USDT_MATIC",
      //"USDT_BSC",
      "BUSD_BSC",
      "tUSDT",
      "tUSDT_TRON",
      "tUSDT_MATIC",
      "tUSDT_BSC",
      "STLV2_BSC",
      "STYL_BSC",
    ].includes(a.currency)
  )) {
    let ca = account.currency;
    if(ca=="STLV2_BSC"){
      ca = "STL_BSC"
    }
    if (
      await AddressModel.count({
        where: { currency: ca, index: 0 },
      })
    )
      continue;

    // register deposit address and save in the db

    const chain = ["ETH", "USDT", "tUSDT"].includes(account.currency)
      ? "ETH"
      : ["TRON", "USDT_TRON", "tUSDT_TRON"].includes(account.currency)
      ? "TRON"
      : ["MATIC", "USDT_MATIC", "tUSDT_MATIC"].includes(account.currency)
      ? "MATIC"
      : "BSC";

    const wallet = await tatum.generateWallet(
      chain,
      testnet,
      process.env["TATUM_" + chain + "_MNEMONIC"]
    );

    const address = await tatum.generateAddressFromXPub(
      chain,
      testnet,
      wallet.xpub,
      0
    );

    //await assignDepositAddressAndIndex(account.id, address);

    let currency = account.currency;
    if(account.currency === "STLV2_BSC"){
      currency = "STL_BSC"
    }

    await AddressModel.create({
      address,
      tatumId: account.id,
      currency,
      clientId: 0,
      userId: 0,
      index: 0,
    });
  }
}
