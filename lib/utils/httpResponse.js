const httpStatus = require('http-status');
const response = ({
    res,
    statusCode = httpStatus.OK,
    status = "success",
    message = null,
    data = null,
    error = null
}) => {
    return res.status(statusCode).json({
        status,
        message,
        data,
        error
    });
}

const handdleApiError = (res, e) => {
    const eArray = e.message.split('|');
    if (process.env.NODE_ENV != 'production') {
        console.log('*** API Error: ', eArray[0]);
        console.log(e)
    }
    return response({
        res,
        statusCode: httpStatus?.[eArray[0]] ?? 500,
        status: 'error',
        error: eArray[1] ?? e.message
    });
}

module.exports = {
    response,
    apiError: handdleApiError
}