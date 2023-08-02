const {
  httpResponse: { response, apiError },
  httpStatus,
} = require("./../../utils");
const { swapService } = require("./../../services");

exports.swap = async (req, res) => {
  try {
    const data = await swapService.swap(req.body);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.price = async (req, res) => {
  try {
    const data = await swapService.swapPrice(req.body);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};
