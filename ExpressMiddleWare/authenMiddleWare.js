const logger = require('../Log/logger');
const excluedPathList = require('./ExcludePathList');
const errInfo = "no authenKey";

function allRequest(req, res, next) {
    let url = req.path;
    let isHtml = url.endsWith('.html');
    if (url === '/' || isHtml) {
        if (req.session.user || excluedPathList.indexOf(req.path) > -1) {
            next();
        } else {
            res.redirect('/login.html');
        }
    } else {
        next();
    }

}

function requireAuthenKey(req, res, next) {
    if (req.headers.authenkey || excluedPathList.indexOf(req.path) > -1) {
        if (req.headers.authenkey) {
            req.headers.authenKey = req.headers.authenkey;
        }
        next();
    } else {
        res.status(401).send(errInfo);
        logger.error(errInfo + ':' + req.path);
        return;
    }
}

let requireRole = function(role) {
    return function(req, res, next) {
        if (req.session.user && req.session.user.role === role) {
            console.log(req.session.user);
            next();
        } else {
            res.status(403).send("you have no right to access this path");
        }
    }
}

let requireLogined = function() {
    return function(req, res, next) {
        if (req.session.user || excluedPathList.indexOf(req.path) > -1) {
            next();
        } else {
            res.redirect('/login.html');
        }
    }
}

module.exports = {
    allRequest,
    requireAuthenKey,
    requireRole,
    requireLogined
}