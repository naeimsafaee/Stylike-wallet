const { ethers, Wallet } = require("ethers");
const Web3 = require("web3");
const abi = require("human-standard-token-abi");
const config = require("config");
const gasConfig = require("../data/gass_config");

const url = config.get("bsc_rpc_url");
const web3 = new Web3(url);

const gasApprovalLimit = 100000;
const gasTradingLimit = 250000;
const gasPrice = 5;

function getGasConfig(tokenIn, tokenOut) {
  var out = {gasPrice, gasTradingLimit};
  var cfg = gasConfig.find(c=>c.from.toLowerCase() == tokenIn.toLowerCase() && c.to.toLowerCase()==tokenOut.toLowerCase());

  if(cfg){
    out.gasPrice = cfg.gasPrice;
    out.gasTradingLimit = cfg.gasLimit;
  }
  return out;
}

exports.getAllowance = async (
  tickerTokenAddress,
  thisWalletAddress,
  liquidtyPoolRouter
) => {
  var contract = new web3.eth.Contract(abi, tickerTokenAddress);
  let approvalLimit = await contract.methods
    .allowance(thisWalletAddress, liquidtyPoolRouter)
    .call();
  let decimals = await contract.methods.decimals().call();
  return [approvalLimit, approvalLimit / 10 ** decimals, decimals];
};

exports.getAmountsOut = async (
  router,
  tokensIn,
  tokensOut,
  decimals,
  balanceIn,
  slippage
) => {
  try {
    let amountIn = ethers.utils.parseUnits(balanceIn.toString(), decimals);
    let amounts = await router.getAmountsOut(amountIn, [tokensIn, tokensOut]);

    let amountOutMin = amounts[1].sub(amounts[1].mul(slippage).div(100));

    return amountOutMin;
  } catch (error) {
    console.log(" *** Error in getAmountsOut:", error);
  }
};

exports.getAmountsIn = async (
  router,
  tokensIn,
  tokensOut,
  decimals,
  balanceIn,
  slippage
) => {
  try {
    let amountIn = ethers.utils.parseUnits(balanceIn.toString(), decimals);
    let amounts = await router.getAmountsIn(amountIn, [tokensIn, tokensOut]);
    let amountInMin = amounts[0].sub(amounts[0].mul(slippage).div(100));

    return amountInMin;
  } catch (error) {
    console.log(" *** Error in getAmountsIn:", error);
  }
};

exports.getApproval = async (
  thisTokenAddress,
  approvalAmount,
  thisDecimals,
  walletAccount,
  liquidtyPoolRouter,
  thisGasPrice = gasPrice,
  thisGasLimit = gasApprovalLimit
) => {
  let contract = new ethers.Contract(thisTokenAddress, abi, walletAccount);
  let approveResponse = await contract.approve(
    liquidtyPoolRouter,
    ethers.utils.parseUnits(approvalAmount.toString(), thisDecimals),
    {
      gasLimit: thisGasLimit,
      gasPrice: ethers.utils.parseUnits(thisGasPrice.toString(), "gwei"),
    }
  );
};

exports.swapExactBNBForTokens = async ({
  routerV2,
  account,
  tokensIn,
  tokensOut,
  decimals,
  balanceIn,
  slippage,
}) => {
  var {gasPrice, gasTradingLimit} = getGasConfig('BNB', tokensOut);
  let amountIn = ethers.utils.parseUnits(balanceIn.toString(), decimals);
  let amounts = await routerV2.getAmountsOut(amountIn, [tokensIn, tokensOut]);
  let amountOutMin = amounts[1].sub(amounts[1].mul(slippage).div(100));
  let tx = await routerV2.swapExactETHForTokens(
    amountOutMin,
    [tokensIn, tokensOut],
    account.address,
    Date.now() + 1000 * 60 * 10,
    {
      value: amountIn,
      gasLimit: gasTradingLimit,
      gasPrice: ethers.utils.parseUnits(gasPrice.toString(), "gwei"),
    }
  );
  let receipt = await tx.wait();
  return { data: receipt, amountOut: amounts[1] };
};

exports.swapExactTokensForBNB = async ({
  routerV2,
  account,
  tokensIn,
  tokensOut,
  decimals,
  balanceIn,
  slippage,
}) => {
  var {gasPrice, gasTradingLimit} = getGasConfig(tokensIn, 'BNB');
  let amountIn = ethers.utils.parseUnits(balanceIn.toString(), decimals);
  let amounts = await routerV2.getAmountsOut(amountIn, [tokensIn, tokensOut]);
  let amountOutMin = amounts[1].sub(amounts[1].mul(slippage).div(100));

  let tx = await routerV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
    amountIn,
    amountOutMin,
    [tokensIn, tokensOut],
    account.address,
    Date.now() + 1000 * 60 * 10,
    {
      gasLimit: gasTradingLimit,
      gasPrice: ethers.utils.parseUnits(gasPrice.toString(), "gwei"),
    }
  );

  let receipt = await tx.wait();
  return { data: receipt, amountOut: amounts[1] };
};

exports.swapExactTokensForToken = async ({
  routerV2,
  account,
  tokensIn,
  tokensOut,
  decimals,
  balanceIn,
  slippage,
}) => {
  var {gasPrice, gasTradingLimit} = getGasConfig(tokensIn, tokensOut);
  let amountIn = ethers.utils.parseUnits(balanceIn.toString(), decimals);
  let amounts = await routerV2.getAmountsOut(amountIn, [tokensIn, tokensOut]);
  let amountOutMin = amounts[1].sub(amounts[1].mul(slippage).div(100));

  let tx = await routerV2.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    [tokensIn, tokensOut],
    account.address,
    Date.now() + 1000 * 60 * 10,
    {
      gasLimit: gasTradingLimit,
      gasPrice: ethers.utils.parseUnits(gasPrice.toString(), "gwei"),
    }
  );

  let receipt = await tx.wait();
  return { data: receipt, amountOut: amounts[1] };
};
