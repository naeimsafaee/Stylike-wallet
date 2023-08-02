const Joi = require('joi');
const { pick, httpResponse, httpStatus } = require('../utils');

const validate = (schema) => (req, res, next) => {
    const validSchema = pick(schema, ['params', 'query', 'body']);
    const object = pick(req, Object.keys(validSchema));
    const { value, error } = Joi.compile(validSchema)
        .prefs({ errors: { label: 'key' } })
        .validate(object);

    if (error) {
        const errorMessage = error.details.map((details) => details.message).join(', ');
        if (process.env.NODE_ENV != 'production') console.log('*** VALIDATION Error: ', errorMessage);
        return httpResponse.response({
            res,
            status: 'error',
            message: 'BAD REQUEST',
            statusCode: httpStatus.BAD_REQUEST,
            error: errorMessage
        });
    }
    Object.assign(req, value);
    return next();
}

module.exports = validate;
