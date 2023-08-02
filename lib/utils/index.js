module.exports = {
    httpResponse: require('./httpResponse'),
    httpStatus: require('http-status'),
    pick: require('./pick'),
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}