const logger = require('../Log/logger');
const excluedPathList = require('./ExcludePathList');
const errInfo = "no authenKey";

function LoginAuthen(req, res, next) {
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
module.exports = LoginAuthen;