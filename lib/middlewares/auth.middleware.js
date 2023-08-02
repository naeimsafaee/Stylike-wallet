const { httpResponse: {  apiError } } = require('../utils');
module.exports = async (req, res, next) => {
  if (req.get("X-API-KEY") !== require("config").get("authentication.apiKey"))
    return apiError(res, Error("UNAUTHORIZED"));
  return next();
};
