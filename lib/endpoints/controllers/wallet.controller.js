const {
  httpResponse: { response, apiError },
  httpStatus,
} = require("./../../utils");
const { addressService } = require("./../../services");

exports.read = async (req, res) => {
  try {
    const data = await addressService.read();
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.config = async (req, res) => {
  try {
    const data = await addressService.config();
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.getAddress = async (req, res) => {
  try {
    const data = await addressService.generateAddress(req.query);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.postWithraw = async (req, res) => {
  try {
    const data = await addressService.createOutgoingTransaction(req.body);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.createNft = async (req, res) => {
  try {
    const data =
      req?.params?.id || req?.body?.ids
        ? await addressService.mintNft({ ...req.body, ...req.params })
        : await addressService.createNft();
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.transferNft = async (req, res) => {
  try {
    const data = await addressService.transferNft(req.body);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

/**
 * mint stl token
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.mintToken = async (req, res) => {
  try {
    const data = await addressService.mintToken(req.body);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

/**
 * burn stl token
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.burnToken = async (req, res) => {
  try {
    const data = await addressService.burnToken(req.body);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.getNft = async (req, res) => {
  try {
    const data = await addressService.getNft({
      ...req.query,
      ...req.params,
    });
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.burnNft = async (req, res) => {
  try {
    const data = await addressService.burnNft({
      ...req.body,
      ...req.params,
    });
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};

exports.swap = async (req, res) => {
  try {
    const data = await addressService.swap(req.body);
    return response({ res, statusCode: httpStatus.OK, data });
  } catch (e) {
    return apiError(res, e);
  }
};
