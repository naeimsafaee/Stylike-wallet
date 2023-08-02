const Web3 = require("web3");

const erc721Abi = require("./erc721-abi");
const erc721Bytecode = require("./erc721-bytecode");

module.exports.getWeb3 = ({ chain, fromPrivateKey, testnet = false }) => {
    let rpc;
    switch (chain) {
        case "ETH":
            rpc = testnet
                ? "https://rpc.ankr.com/eth_ropsten/"
                : "https://rpc.ankr.com/eth/";
            break;
        case "BSC":
            rpc = testnet
                ? "https://data-seed-prebsc-1-s1.binance.org:8545/"
                : "https://bsc-dataseed.binance.org/";
            break;
        case "MATIC":
            rpc = testnet
                ? "https://rpc-mumbai.maticvigil.com/"
                : "https://polygon-rpc.com/";
            break;
        default:
            throw Error("NOT_FOUND|chain not found");
    }

    const web3 = new Web3(rpc);
    if (fromPrivateKey) {
        web3.eth.accounts.wallet.clear();
        web3.eth.accounts.wallet.add(fromPrivateKey);
        web3.eth.defaultAccount = web3.eth.accounts.wallet[0].address;
    }
    return web3;
};

module.exports.sendTransaction = async ({
    web3,
    transaction,
    fromPrivateKey,
}) => {
    transaction.gasPrice = await web3.eth.getGasPrice();
    transaction.gas = await web3.eth.estimateGas(transaction);

    const signedTransaction = (
        await web3.eth.accounts.signTransaction(transaction, fromPrivateKey)
    ).rawTransaction;

    return new Promise((resolve, reject) => {
        web3.eth.sendSignedTransaction(signedTransaction, (error, hash) => {
            if (error) return reject(error);
            resolve(hash);
        });
    });
};

module.exports.createContract = async ({
    chain,
    name,
    symbol,
    fromPrivateKey,
    testnet,
}) => {
    const web3 = this.getWeb3({ chain, fromPrivateKey, testnet });

    const contract = new web3.eth.Contract(erc721Abi, null, {
        data: erc721Bytecode,
    });

    const deploy = contract.deploy({ arguments: [name, symbol] });

    const transaction = {
        data: deploy.encodeABI(),
    };

    return await this.sendTransaction({ web3, transaction, fromPrivateKey });
};

module.exports.getContractAddress = async ({ chain, hash, testnet }) => {
    const web3 = this.getWeb3({ chain, testnet });
    return (await web3.eth.getTransactionReceipt(hash)).contractAddress;
};

module.exports.mint = async ({
    chain,
    fromPrivateKey,
    contractAddress,
    to,
    id,
    url,
    testnet,
}) => {
    if (!Array.isArray(to)) {
        to = [to];
        id = [id];
        url = [url];
    }

    const web3 = this.getWeb3({ chain, fromPrivateKey, testnet });

    const contract = new web3.eth.Contract(erc721Abi, contractAddress);

    const transaction = {
        value: 0,
        to: contractAddress.trim(),
        data: contract.methods
            .mintMultiple(
                to.map((t) => t.trim()),
                id,
                url,
                0
            )
            .encodeABI(),
    };

    return await this.sendTransaction({ web3, transaction, fromPrivateKey });
};

module.exports.transfer = async ({
    chain,
    fromPrivateKey,
    from,
    contractAddress,
    to,
    id,
    testnet,
}) => {
    const web3 = this.getWeb3({ chain, fromPrivateKey, testnet });

    const contract = new web3.eth.Contract(erc721Abi, contractAddress);
    
    const transaction = {
        to: contractAddress.trim(),
        data: contract.methods.safeTransferFrom(from, to, id, '0x').encodeABI(),
    };

    return await this.sendTransaction({ web3, transaction, fromPrivateKey });
};

module.exports.burn = async ({
    chain,
    fromPrivateKey,
    contractAddress,
    id,
    testnet,
}) => {
    const web3 = this.getWeb3({ chain, fromPrivateKey, testnet });

    const contract = new web3.eth.Contract(erc721Abi, contractAddress);

    const transaction = {
        to: contractAddress.trim(),
        data: contract.methods.burn(id).encodeABI(),
    };

    return await this.sendTransaction({ web3, transaction, fromPrivateKey });
};

module.exports.getBalance = async ({
    chain,
    contractAddress,
    address,
    testnet,
}) => {
    const web3 = this.getWeb3({ chain, testnet });

    const contract = new web3.eth.Contract(erc721Abi, contractAddress);

    return await contract.methods.balanceOf(address).call();
};
