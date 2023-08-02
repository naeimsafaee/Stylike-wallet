const { addressService } = require("../../services");

exports.incoming = async (req, res) => {
  try {
    addressService.createIncomingTransaction(req.body);
  } catch (e) {
    console.log(e);
  }
  return res.status(200).send();
};

exports.outgoing = async (req, res) => {
  try {
    addressService.compeleteOutgoingTransaction(req.body);
  } catch (e) {
    console.log(e);
  }
  return res.status(200).send();
};
