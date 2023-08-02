const {redis, postgres} = require("../lib/databases");
const tokens = require('../lib/data/token');
const config = require("config");
const Web3 = require("web3");
const {JsonRpcProvider} = require("@ethersproject/providers");
const {Wallet} = require("ethers");
const telegram = require("../lib/utils/telegram");
const {getErc20AccountBalance} = require("../lib/utils/web3");

const zeroBalanceNotification = async () => {
    try {
        for (const token of config.get("cron.zero_balance_notification.origin_tokens") || []) {
            let wallet = await postgres.AddressModel.findOne({
                where: {
                    index: 0,
                    currency: token.symbol,
                    balance: {
                        [postgres.Op.lte]: token.min
                    },
                },
                raw: true
            });

            if (!wallet) continue;

            const {currency, balance, address} = wallet;
            await sendNotification({currency, balance, address, accountType: "origin"});
        }

        let url = config.get("bsc_rpc_url");
        const provider = new JsonRpcProvider(url);
        const secretKey = process.env.SWAP_WALLET_SECRET_KEY;
        const account = new Wallet(secretKey, provider);

        for (const token of config.get("cron.zero_balance_notification.swap_tokens") || []) {
            const isNativeToken = ["BNB", "BSC"].includes(token.symbol);
            let balance = 0;
            let address = "";

            if (isNativeToken) {
                const b = await account.getBalance();
                balance = Number(Web3.utils.fromWei(b.toString(), "ether"))
                address = account.address;
            } else {
                const contract = tokens.find(f => f.symbol === token.symbol);
                if (!contract) continue;
                address = account.address;
                balance = await getErc20AccountBalance(address, contract.address, "BSC");
            }

            if (balance > token.min) continue;

            await sendNotification(
                {currency: token.symbol, balance, address, accountType: "swap"}
            );
        }
    } catch (e) {
    }
}

const sendNotification = async (data) => {
    try {
        const {currency, balance, address, accountType} = data;
        const expireAt = config.get("cron.zero_balance_notification.notification_at") || 60;
        const key = redisKey(currency, accountType);

        const r = await redis.client.get(key);
        if (r) return;

        const message = `${currency} token balance is running out: \n\n balance: ${balance}\n account type: ${accountType}\n address: ${address}`

        await telegram.sendMessage(message);

        await redis.client.set(key, "true");
        await redis.client.expire(key, expireAt);
    } catch (e) {
        console.log(e);
    }
};

const redisKey = (key, type) => {
    return `${key}_${type}_NOTIFICATION_AT`;
}

module.exports = {
    zeroBalanceNotification
}