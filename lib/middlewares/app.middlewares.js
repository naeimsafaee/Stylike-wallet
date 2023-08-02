const express = require('express');

module.exports = app => {

    if (process.env.NODE_ENV === 'development') {
        app.use(require('morgan')('dev'));
    }

    app.use('*', require('cors')({
        origin: '*',
        credentials: true
    }));

    app.use(express.urlencoded({
        limit: '2mb',
        extended: true,
        parameterLimit: 50
    }));
    app.use(express.json());

    app.enable('strict routing');

    app.use(function (error, req, res, next) {
        if (error instanceof SyntaxError) {
            return res.status(415).send({ data: 'Invalid data' });
        } else {
            next();
        }
    });

    app.use(function (req, res, next) {
        if (req.method === 'OPTIONS') {
            var headers = {};
            headers['Access-Control-Allow-Origin'] = '*';
            headers['Access-Control-Allow-Methods'] = 'OPTIONS';
            headers['Access-Control-Allow-Headers'] = '*';
            res.writeHead(200, headers);
            res.end();
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Credentials', true);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            next();
        }
    });
}