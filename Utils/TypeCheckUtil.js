const logger = require('../Log/logger');

function isString(arg) {
    return arg && typeof(arg) == "string";
}

function isNumber(arg) {
    return arg && typeof(arg) == "number" && !isNaN(arg);
}

function isBoolean(arg) {
    return arg === !!arg;
}

function isArray(arg) {
    return Object.prototype.toString.call(arg) == '[object Array]';
}

function isObject(arg) {
    return Object.prototype.toString.call(arg) == '[object Object]';
}

function isFunction(arg) {
    return Object.prototype.toString.call(arg) == '[object Function]';
}

function isEmpty(arg) {
    return Object.keys(arg).length === 0;
}

/**
 * 
 * @param {Function} func the function which is used to check
 * @param {Object} arg target object
 * @param {String} varName variable name
 * @returns {Boolean} if false ,the process will exit 1
 */
function checkType(func, arg, varName = '') {
    let ok = func(arg);
    if (!ok) {
        let typeName = typeof arg;
        let funcStr = func.toString();
        let re = /function\s*(\w*)/i;
        let matches = re.exec(funcStr); //方法名
        let needType = matches[1];
        let info = `you need data's type  ${needType},but the data '${varName}' type is ${typeName}`;
        logger.error(info);
        process.exit(1);
    } else {
        return true;
    }
}
module.exports = {
    isString: isString,
    isNumber: isNumber,
    isBoolean: isBoolean,
    isArray: isArray,
    isObject: isObject,
    isFunction: isFunction,
    isEmpty: isEmpty,
    checkType: checkType
}