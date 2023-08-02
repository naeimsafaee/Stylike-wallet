const config = require("config");
const Web3 = require("web3");

const getErc20AccountBalance = async (
  accountAddress,
  contractAddress,
  chain
) => {
  const url = getRpcUrl(chain);
  const web3 = new Web3(url);
  let abi = [
    {
      constant: true,
      inputs: [
        {
          name: "_owner",
          type: "address",
        },
      ],
      name: "balanceOf",
      outputs: [
        {
          name: "balance",
          type: "uint256",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
  ];
  let contract = new web3.eth.Contract(abi, contractAddress);
  const balance = await contract.methods.balanceOf(accountAddress).call();
  return Number(Web3.utils.fromWei(balance, "ether"));
};

const getTransaction = async (id, chain) => {
  if (!id || !chain) throw Error("invalid id or chain");
  const url = getRpcUrl(chain);
  const web3 = new Web3(url);
  return await web3.eth.getTransactionReceipt(id);
};

const getRpcUrl = (chain) => {
  switch (chain) {
    case "ETH":
      return config.get("eth_rpc_url");
    case "BSC":
      return config.get("bsc_rpc_url");
    case "TRON":
      return config.get("tron_rpc_url");
    default:
      throw Error("chain not found");
  }
};

module.exports = {
  getErc20AccountBalance,
  getTransaction,
};
