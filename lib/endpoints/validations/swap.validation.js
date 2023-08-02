const Joi = require("joi");

const swap = {
  body: {
    userId: Joi.number().required(),
    slippage: Joi.number().min(0).max(50),
    fromToken: Joi.string().required(),
    toToken: Joi.string().required(),
    agent: Joi.string().required(),
    systemFee: Joi.number().required(),
    balanceIn: Joi.number().positive().required(),
    apiLimit: Joi.number().required(),
  },
};

const swapPrice = {
  body: {
    fromToken: Joi.string().required(),
    toToken: Joi.string().required(),
    origin: Joi.string().optional(),
    slippage: Joi.number().min(0).max(50),
    balanceIn: Joi.number().positive().required(),
  },
};

module.exports = {
  swap,
  swapPrice,
};
