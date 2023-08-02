const Joi = require("joi");

const getAddress = {
  query: {
    currency: Joi.string()
      .max(12)
      .required(),
    clientId: Joi.number()
      .integer()
      .min(1)
      .default(1),
    userId: Joi.number()
      .integer()
      .min(0),
  },
};

const postWithdraw = {
  body: {
    currency: Joi.string()
      .max(10)
      .required(),
    paymentId: Joi.number()
      .integer()
      .positive()
      .required(),
    amount: Joi.number()
      .positive()
      .required(),
    fee: Joi.number(),
    gasPrice: Joi.number(),
    gasLimit: Joi.number(),
    address: Joi.string()
      .max(255)
      .required(),
    tag: Joi.string().max(255),
    senderNote: Joi.string().max(255),
    index: Joi.number().integer(),
    clientId: Joi.number()
      .integer()
      .min(1)
      .default(1),
  },
};

module.exports = {
  getAddress,
  postWithdraw,
};
