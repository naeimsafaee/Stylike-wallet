const {redis, postgres} = require("./../databases");
const {ethers, Wallet} = require("ethers");
const Web3 = require("web3");
const {JsonRpcProvider} = require("@ethersproject/providers");
const tokenData = require("../data/token");
const {createApiCode} = require("../utils/utils");
const {
    increaseFrozenBalance,
    decreaseFrozenBalance,
} = require("../services/wallet.service");
const config = require("config");
const {getErc20AccountBalance} = require("../utils/web3");
const swapRouter = require("../data/router");

const {
    swapExactBNBForTokens,
    swapExactTokensForBNB,
    swapExactTokensForToken,
    getAmountsOut,
    getAmountsIn,
} = require("../utils/liquidity");

function settingParser(val) {
    if (!val) {
        throw new Error("value is empty");
    }
    const oneIndex = function (v) {
        let s = v.split("=");
        if (s.length !== 2) {
            return 0;
        }
        return Number(s[1]);
    };
    let setting = {
        min: 0,
        max: 0,
        fee: 0,
    };
    const spl = val.split("-");
    for (const str of spl) {
        if (str.startsWith("min")) {
            setting.min = oneIndex(str);
        } else if (str.startsWith("max")) {
            setting.max = oneIndex(str);
        } else if (str.startsWith("fee")) {
            setting.fee = oneIndex(str);
        }
    }
    return setting;
}

function getTokenName(val) {
    let txt = val;
    ["_BSC", "_TRON", "_MATIC"].forEach((r) => {
        const regex = new RegExp(r, "g");
        txt = txt.replace(regex, "");
    });
    return txt;
}

const swap = async (data) => {
    let {userId, slippage, agent, fromToken, toToken, balanceIn, systemFee, apiLimit} =
        data;
    let errorMessage = "";
    try {

        if (fromToken == "ETH") {
            fromToken = "WETH";
        }
        if (toToken == "ETH") {
            toToken = "WETH";
        }

        let systemProfit = 0;
        if (systemFee > 0) {
            systemProfit = (balanceIn * systemFee) / 100;
        }
        if (balanceIn < systemProfit) {
            errorMessage =
                "The operation is currently not possible. Please try again later";
            throw new Error(errorMessage);
        }

        let fToken = fromToken == "WETH" ? "ETH" : fromToken;
        let tToken = toToken == "WETH" ? "ETH" : toToken;

        const assets = await postgres.AssetNetwork.findAll({
            where: {apiCode: {[postgres.Op.in]: [fToken, tToken]}},
            raw: true,
        });

        let assetIn = assets.find((a) => a.apiCode == fToken);
        let assetOut = assets.find((a) => a.apiCode == tToken);

        if (!assetIn) {
            errorMessage = `${fromToken} Token Not Found`;
            throw new Error(errorMessage);
        }
        if (!assetOut) {
            errorMessage = `${toToken} Token Not Found`;
            throw new Error(errorMessage);
        }

        const userWallets = await postgres.UserWalletModel.findAll({
            where: {
                userId,
                assetId: {[postgres.Op.in]: [assetIn.assetId, assetOut.assetId]},
            },
            raw: true,
        });

        let fromWallet = null;
        let toWallet = null;

        for (const w of userWallets) {
            if (w.assetId == assetIn.assetId) {
                fromWallet = w;
            } else if (w.assetId == assetOut.assetId) {
                toWallet = w;
            }
        }

        if (!fromWallet) {
            errorMessage = "WalletIn Not Found";
            throw new Error(errorMessage);
        }
        if (!toWallet) {
            errorMessage = "WalletOut Not Found";
            throw new Error(errorMessage);
        }

        if (fromWallet.amount < balanceIn) {
            errorMessage = "The balance of the wallet is not enough";
            throw new Error(errorMessage);
        }

        ///////////////////////////////////////////////////////////////////////////
        //TODO, required create a function for account builder
        let url = config.get("eth_rpc_url");
        const provider = new JsonRpcProvider(url);
        const secretKey = process.env.SWAP_WALLET_SECRET_KEY;
        const account = new Wallet(secretKey, provider);
        ///////////////////////////////////////////////////////////////////////////

        const fromIsNativeToken = isNativToken(fromToken);
        const toIsNativeToken = isNativToken(toToken);

        if (fromToken == toToken || (fromIsNativeToken && toIsNativeToken)) {
            errorMessage = "You cannot swap native token to native token";
            throw new Error(errorMessage);
        }

        const chain = getChainName(fromToken);
        if (chain != getChainName(toToken)) {
            errorMessage = "Chain No two tokens are the same";
            throw new Error(errorMessage);
        }

        const from = contractAddressBySymbol(fromToken);
        const to = contractAddressBySymbol(toToken);

        const tokensInAddress = Web3.utils.toChecksumAddress(from.address);
        const tokensOutAddress = Web3.utils.toChecksumAddress(to.address);

        const routerV2 = routerBuilder(chain, fromToken, toToken);

        const swapData = {
            routerV2,
            account,
            tokensIn: tokensInAddress,
            tokensOut: tokensOutAddress,
            decimals: from.decimals,
            balanceIn: balanceIn - systemProfit,
            slippage: 1,
        };

        let zeroWalletBalance = 0;

        if (fromToken == "BNB" || fromToken == "WBNB") {
            zeroWalletBalance = await account.getBalance();
        } else {
            zeroWalletBalance = await getErc20AccountBalance(
                account.address,
                tokensInAddress,
                chain
            );
        }

        if (zeroWalletBalance < balanceIn) {
            console.log(
                `The balance of origin wallet is not enough: ${
                    fromToken == "WBNB" ? "BNB" : fromToken
                }`
            );
            errorMessage =
                "The operation is currently not possible. Please try again later";
            throw new Error(errorMessage);
        }

        const swapTx = await postgres.SwapModel.create({
            userId,
            assetInId: assetIn.assetId,
            assetOutId: assetOut.assetId,
            balanceIn,
            amountOut: 0,
            fee: 0,
            agent,
            currentWalletInBalance: fromWallet.amount,
            afterWalletInBalance: 0,
            currentWalletInFrozen: fromWallet.frozen,
            afterWalletInFrozen: 0,
            currentWalletOutBalance: toWallet.amount,
            afterWalletOutBalance: 0,
            status: "request",
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const increaseFrozen = await increaseFrozenBalance(
            userId,
            assetIn.assetId,
            +balanceIn,
            swapTx.id
        );

        if (!increaseFrozen) {
            throw new Error("Internal Error");
        }

        let receipt = null;

        try {
            if (!fromIsNativeToken && !toIsNativeToken) {
                receipt = await swapExactTokensForToken(swapData);
            } else if (!fromIsNativeToken && toIsNativeToken) {
                receipt = await swapExactTokensForBNB(swapData);
            } else if (fromIsNativeToken && !toIsNativeToken) {
                receipt = await swapExactBNBForTokens(swapData);
            }
        } catch (error) {
            console.log("*** swap error:", error);
            await decreaseFrozenBalance(
                userId,
                assetIn.assetId,
                +balanceIn,
                true,
                swapTx.id
            );
            throw new Error("Internal Error");
        }

        if (!receipt) {
            console.log("*** swap error:", "receipt is null");
            await decreaseFrozenBalance(
                userId,
                assetIn.assetId,
                +balanceIn,
                true,
                swapTx.id
            );
            throw new Error("Internal Error");
        }

        let currency = createApiCode(toToken, chain);
        let fee = 0;
        let amountOut = Number(
            Web3.utils.fromWei(receipt.amountOut.toString(), "ether")
        );
        if (fromToken == "WETH" && toToken == "STYL_ETH") {
            amountOut = amountOut * 0.95; // 5 % liquidity fee
            fee = amountOut * 0.5;
        }

        await postgres.SwapModel.update(
            {
                status: "pending",
                amountOut,
                fee,
                profit: systemProfit,
                txId: receipt.data.transactionHash,
            },
            {where: {id: swapTx.id}}
        );

        const utx = await postgres.UserTransaction.create({
            userId,
            type: "SWAP",
            assetNetworkId: assetIn.id,
            amount: balanceIn,
            previousBalance: fromWallet.amount,
            withdrawFee: 0,
            depositFee: 0,
            fee,
            gasPrice: 0,
            gasLimit: 0,
            status: "PENDING",
            origin: "SYSTEM",
            txid: receipt.data.transactionHash,
            assetId: assetIn.assetId,
            profit: systemProfit,
            extra: {
                swapTxId: swapTx.id,
            },
        });

        await redis.client.rpush(
            "SWAP",
            JSON.stringify({
                ...data,
                currency,
                txId: receipt.data.transactionHash,
                chain: chain,
                userId: userId,
                balanceIn: +balanceIn,
                assetInId: assetIn.assetId,
                assetOutId: assetOut.assetId,
                amountOut: amountOut.toFixed(6),
                swapTxId: swapTx.id,
                utxId: utx.id,
            })
        );

        console.log("new swap:", {
            fromToken,
            toToken,
            balanceIn,
            txId: receipt.data.transactionHash,
            assetInId: assetIn.assetId,
            assetOutId: assetOut.assetId,
            amountOut: amountOut.toFixed(6),
            userId: userId,
        });

        return {
            amount: amountOut,
            txId: receipt.data.transactionHash,
            swapTxId: swapTx.id,
        };
    } catch (error) {
        console.log("*** swap error", error);
        const errors = [errorMessage, "Chain No two tokens are the same"];
        if (errors.includes(error.message)) {
            throw new Error(error.message);
        } else {
            throw new Error("Internal Error");
        }
    }
};

const swapPrice = async (data) => {
    try {
        let {slippage, fromToken, toToken, balanceIn, origin} = data;
        if (fromToken == "BNB") {
            fromToken = "WBNB";
        }
        if (toToken == "BNB") {
            toToken = "WBNB";
        }

        if (fromToken == "ETH") {
            fromToken = "WETH";
        }
        if (toToken == "ETH") {
            toToken = "WETH";
        }

        slippage = 1;
        const chain = getChainName(fromToken);
        if (chain != getChainName(toToken)) {
            throw new Error("Chain No two tokens are the same");
        }

        const from = contractAddressBySymbol(fromToken);
        const to = contractAddressBySymbol(toToken);

        const tokensInAddress = Web3.utils.toChecksumAddress(from.address);
        const tokensOutAddress = Web3.utils.toChecksumAddress(to.address);

        const routerV2 = routerBuilder(chain, fromToken, toToken);

        let amount = await getAmountsOut(
            routerV2,
            tokensInAddress,
            tokensOutAddress,
            from.decimals,
            balanceIn,
            slippage
        );

        if (!amount) {
            throw new Error("Internal Error");
        }

        // if (origin == "out") {
        //   amount = await getAmountsOut(
        //     routerV2,
        //     tokensInAddress,
        //     tokensOutAddress,
        //     from.decimals,
        //     balanceIn,
        //     slippage
        //   );
        // } else {
        //   amount = await getAmountsIn(
        //     routerV2,
        //     tokensInAddress,
        //     tokensOutAddress,
        //     to.decimals,
        //     balanceIn,
        //     slippage
        //   );
        // }

        let price = ethers.utils.formatUnits(amount.toString(), to.decimals).toString();

        return {price};

    } catch (error) {
        console.log("*** swapAmount error", error);
        const errors = ["Chain No two tokens are the same"];
        if (errors.includes(error.message)) {
            throw new Error(error.message);
        } else {
            throw new Error("Internal Error");
        }
    }
};

function routeAddress(fromToken, toToken) {
    const router = swapRouter.currencies.find(
        (c) => c.tokens == `${fromToken}->${toToken}`
    );
    if (!router) {
        return swapRouter.routers.pancake;
    }
    const routerAddress = swapRouter.routers[router.router];
    if (!routerAddress) {
        throw new Error(`Router Notfound`);
    }
    return routerAddress;
}

function getChainName(token) {
    return "ETH";
}

function isNativToken(symbol) {
    return symbol == "ETH" || symbol == "WETH" || symbol == "WBNB";
}

function contractAddressBySymbol(symbol) {
    const token = tokenData.find((t) => t.symbol === symbol);
    if (!token) {
        throw new Error(`${symbol} Token Not Found`);
    }
    return {address: token.address, decimals: token.decimals};
}

function routerBuilder(chain, fromToken, toToken) {
    let url = config.get("bsc_rpc_url");
    if (chain == "ETH") {
        url = config.get("eth_rpc_url");
    }

    const provider = new JsonRpcProvider(url);

    const secretKey = process.env.SWAP_WALLET_SECRET_KEY;

    const account = new Wallet(secretKey, provider);

    const router = routeAddress(fromToken, toToken);

    const routerAddress = Web3.utils.toChecksumAddress(router); // Router

    return new ethers.Contract(
        routerAddress,
        [
            "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
            "function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)",
            "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
            "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
            "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
            "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
            "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        ],
        account
    );
}

module.exports = {
    swap,
    swapPrice,
};
