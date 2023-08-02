const transaction_1 = require("../../node_modules/@tatumio/tatum/dist/src/transaction");
const bignumber_js_1 = require('bignumber.js');
const wallet_1 = require('../../node_modules/@tatumio/tatum/dist/src/wallet');
const model_1 = require('../../node_modules/@tatumio/tatum/dist/src/model');
const cardano_serialization_lib_nodejs_1 = require("@emurgo/cardano-serialization-lib-nodejs");

const prepareAdaSignedOffchainTransaction = async (testnet, data, amount, address, mnemonic, keyPair, changeAddress, xpub, multipleAmounts, signatureId) => {
  var _a;
  const txBuilder = await transaction_1.initTransactionBuilder();
  const fromAddress = data.filter(input => input.address).map(input => ({ address: input.address.address }));
  await transaction_1.addAddressInputsWithoutPrivateKey(txBuilder, fromAddress);
  addOffchainInputs(txBuilder, data);
  if (multipleAmounts === null || multipleAmounts === void 0 ? void 0 : multipleAmounts.length) {
      for (const [i, multipleAmount] of multipleAmounts.entries()) {
          transaction_1.addOutputAda(txBuilder, address.split(',')[i], multipleAmount);
      }
  }
  else {
      transaction_1.addOutputAda(txBuilder, address, amount);
  }
  const lastVin = data.find(d => d.vIn === '-1');
  if (new bignumber_js_1.default(lastVin.amount).isGreaterThan(0)) {
      if (xpub) {
          const zeroAddress = await wallet_1.generateAddressFromXPub(model_1.Currency.ADA, testnet, xpub, 0);
          transaction_1.addOutputAda(txBuilder, zeroAddress, lastVin.amount);
      }
      else if (changeAddress) {
          transaction_1.addOutputAda(txBuilder, changeAddress, lastVin.amount);
      }
      else {
          throw new Error('Impossible to prepare transaction. Either xpub or keyPair and attr must be present.');
      }
  }
  const lovelaceFee = transaction_1.adaToLovelace(1);
  txBuilder.set_fee(cardano_serialization_lib_nodejs_1.BigNum.from_str(lovelaceFee));
  const txBody = txBuilder.build();
  if (signatureId) {
      return JSON.stringify({ txData: txBody.to_bytes().toString() });
  }
  const vKeyWitnesses = cardano_serialization_lib_nodejs_1.Vkeywitnesses.new();
  const txHash = cardano_serialization_lib_nodejs_1.hash_transaction(txBody);
  for (const input of data) {
      // when there is no address field present, input is pool transfer to 0
      if (input.vIn === '-1') {
          continue;
      }
      if (mnemonic) {
          const derivationKey = ((_a = input.address) === null || _a === void 0 ? void 0 : _a.derivationKey) || 0;
          const privateKey = await wallet_1.generatePrivateKeyFromMnemonic(model_1.Currency.ADA, testnet, mnemonic, derivationKey);
          transaction_1.makeWitness(privateKey, txHash, vKeyWitnesses);
      }
      else if (keyPair) {
          const { privateKey } = keyPair.find(k => k.address === input.address.address);
          transaction_1.makeWitness(privateKey, txHash, vKeyWitnesses);
      }
      else {
          throw new Error('Impossible to prepare transaction. Either mnemonic or keyPair and attr must be present.');
      }
  }
  const witnesses = cardano_serialization_lib_nodejs_1.TransactionWitnessSet.new();
  witnesses.set_vkeys(vKeyWitnesses);
  return Buffer.from(cardano_serialization_lib_nodejs_1.Transaction.new(txBody, witnesses).to_bytes()).toString('hex');
};
exports.prepareAdaSignedOffchainTransaction = prepareAdaSignedOffchainTransaction;
const addOffchainInputs = (transactionBuilder, inputs) => {
  var _a;
  let amount = new bignumber_js_1.default(0);
  for (const input of inputs) {
      if (input.vIn !== '-1' && input.amount && input.vInIndex !== undefined && ((_a = input.address) === null || _a === void 0 ? void 0 : _a.address)) {
          transaction_1.addInput(transactionBuilder, {
              value: transaction_1.adaToLovelace(input.amount),
              index: input.vInIndex,
              txHash: input.vIn,
          }, input.address.address);
          amount = amount.plus(input.amount);
      }
  }
  return amount;
};