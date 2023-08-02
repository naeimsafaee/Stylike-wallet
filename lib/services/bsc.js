const Tatum = require("@tatumio/tatum");
const web3Utils = require("web3-utils");
const BigNumber = require("bignumber.js");
const Connector = require("../../node_modules/@tatumio/tatum/dist/src/connector/tatum");
const erc721Abi = require("../../node_modules/@tatumio/tatum/dist/src/contracts/erc721/erc721_abi")
  .default;
const erc721Bytecode = require("../../node_modules/@tatumio/tatum/dist/src/contracts/erc721/erc721_bytecode")
  .default;
const erc721ProvenanceAbi = require("../../node_modules/@tatumio/tatum/dist/src/contracts/erc721Provenance/erc721Provenance_abi")
  .default;
const erc721ProvenanceBytecode = require("../../node_modules/@tatumio/tatum/dist/src/contracts/erc721Provenance/erc721Provenance_bytecode")
  .default;

exports.sendDeployBep721Transaction = async (body, provider) =>
  Tatum.bscBroadcast(
    await prepareBscDeployBep721SignedTransaction(body, provider),
    body.signatureId
  );

const prepareBscDeployBep721SignedTransaction = async (body, provider) => {
  await Connector.validateBody(body, Tatum.EthDeployErc721);

  const {
    fromPrivateKey,
    fee,
    name,
    symbol,
    nonce,
    signatureId,
    provenance,
    publicMint,
    testnet,
  } = body;

  const client = Tatum.getBscClient(provider, fromPrivateKey);

  const contract = new client.eth.Contract(
    provenance ? erc721ProvenanceAbi : erc721Abi,
    null,
    {
      data: provenance ? erc721ProvenanceBytecode : erc721Bytecode,
    }
  );

  const deploy = contract.deploy({
    arguments: [name, symbol, publicMint ? publicMint : false],
  });

  const tx = {
    from: 0,
    data: deploy.encodeABI(),
    nonce,
  };

  return await prepareBscSignedTransactionAbstraction(
    client,
    tx,
    signatureId,
    fromPrivateKey,
    fee,
    testnet
  );
};

const prepareBscSignedTransactionAbstraction = async (
  client,
  transaction,
  signatureId,
  fromPrivateKey,
  fee,
  testnet
) => {
  transaction.gasPrice = fee?.gasPrice
    ? client.utils.toWei(fee.gasPrice, "gwei")
    : bscGetGasPriceInWei(testnet);

  if (signatureId) return JSON.stringify(transaction);

  transaction.gas = fee?.gasLimit
    ? fee.gasLimit
    : await client.eth.estimateGas(transaction);

  return (
    await client.eth.accounts.signTransaction(transaction, fromPrivateKey)
  ).rawTransaction;
};

const bscGetGasPriceInWei = (testnet = false) =>
  web3Utils.toWei(testnet ? "10" : "5", "gwei");

exports.sendMintBep721Transaction = async (body, provider) => {
  if (!body.fromPrivateKey) return Tatum.mintNFT(body);

  return Tatum.bscBroadcast(
    await prepareBscMintBep721SignedTransaction(body, provider),
    body.signatureId
  );
};

const prepareBscMintBep721SignedTransaction = async (body, provider) => {
  await Connector.validateBody(body, Tatum.EthMintErc721);

  const {
    fromPrivateKey,
    to,
    tokenId,
    contractAddress,
    nonce,
    fee,
    url,
    signatureId,
    testnet,
  } = body;

  const client = Tatum.getBscClient(provider, fromPrivateKey);

  const contract = new client.eth.Contract(erc721Abi, contractAddress);

  if (contractAddress) {
    const tx = {
      from: 0,
      to: contractAddress.trim(),
      data: contract.methods
        .mintWithTokenURI(to.trim(), tokenId, url)
        .encodeABI(),
      nonce,
    };

    return await prepareBscSignedTransactionAbstraction(
      client,
      tx,
      signatureId,
      fromPrivateKey,
      fee,
      testnet
    );
  }
  throw new Error("Contract address should not be empty");
};

exports.sendBep721Transaction = async (body, provider) =>
  Tatum.bscBroadcast(
    await prepareBscTransferBep721SignedTransaction(body, provider),
    body.signatureId
  );

const prepareBscTransferBep721SignedTransaction = async (body, provider) => {
  await Connector.validateBody(body, Tatum.EthTransferErc721);

  const {
    fromPrivateKey,
    to,
    tokenId,
    fee,
    contractAddress,
    nonce,
    signatureId,
    value,
    provenance,
    provenanceData,
    tokenPrice,
    testnet,
  } = body;

  const client = Tatum.getBscClient(provider, fromPrivateKey);

  const contract = new client.eth.Contract(
    provenance ? erc721ProvenanceAbi : erc721Abi,
    contractAddress
  );

  const dataBytes = provenance
    ? Buffer.from(
        provenanceData + "'''###'''" + web3Utils.toWei(tokenPrice, "ether"),
        "utf8"
      )
    : "";

  const tokenData = provenance
    ? contract.methods
        .safeTransfer(to.trim(), tokenId, `0x${dataBytes.toString("hex")}`)
        .encodeABI()
    : contract.methods.safeTransfer(to.trim(), tokenId).encodeABI();

  const tx = {
    from: 0,
    to: contractAddress.trim(),
    data: tokenData,
    nonce,
    value: value
      ? `0x${new BigNumber(value).multipliedBy(1e18).toString(16)}`
      : undefined,
  };

  return await prepareBscSignedTransactionAbstraction(
    client,
    tx,
    signatureId,
    fromPrivateKey,
    fee,
    testnet
  );
};

exports.sendMintMultipleBep721Transaction = async (body, provider) =>
  Tatum.bscBroadcast(
    await prepareBscMintMultipleBep721SignedTransaction(body, provider),
    body.signatureId
  );

const prepareBscMintMultipleBep721SignedTransaction = async (
  body,
  provider
) => {
  await Connector.validateBody(body, Tatum.EthMintMultipleErc721);

  const {
    fromPrivateKey,
    to,
    tokenId,
    contractAddress,
    url,
    nonce,
    signatureId,
    fee,
    testnet,
  } = body;

  const client = Tatum.getBscClient(provider, fromPrivateKey);

  const contract = new client.eth.Contract(erc721Abi, contractAddress);

  const tx = {
    from: 0,
    to: contractAddress.trim(),
    data: contract.methods
      .mintMultiple(
        to.map((t) => t.trim()),
        tokenId,
        url
      )
      .encodeABI(),
    nonce,
  };

  return await prepareBscSignedTransactionAbstraction(
    client,
    tx,
    signatureId,
    fromPrivateKey,
    fee,
    testnet
  );
};

exports.sendBurnBep721Transaction = async (body, provider) =>
  Tatum.bscBroadcast(
    await prepareBscBurnBep721SignedTransaction(body, provider),
    body.signatureId
  );

const prepareBscBurnBep721SignedTransaction = async (body, provider) => {
  await Connector.validateBody(body, Tatum.EthBurnErc721);
  const {
    fromPrivateKey,
    tokenId,
    fee,
    contractAddress,
    nonce,
    signatureId,
    testnet,
  } = body;

  const client = Tatum.getBscClient(provider, fromPrivateKey);

  const contract = new client.eth.Contract(erc721Abi, contractAddress);

  const tx = {
    from: 0,
    to: contractAddress.trim(),
    data: contract.methods.burn(tokenId).encodeABI(),
    nonce,
  };

  return await prepareBscSignedTransactionAbstraction(
    client,
    tx,
    signatureId,
    fromPrivateKey,
    fee,
    testnet
  );
};
