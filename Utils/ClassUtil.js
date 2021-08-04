/**
 * 是否拥有某个方法
 * @param {Object} obj 
 * @param {string} methodName 
 * @returns bool
 */
function hasMethod(obj, methodName) {
    return ((typeof obj[methodName]) == "function");
}

function hasMethods(obj /*, method list as strings */){
    let i = 1, methodName;
    while((methodName = arguments[i++])){
        if(typeof obj[methodName] != 'function') {
            return false;
        }
    }
    return true;
}
 
module.exports={
    hasMethod:hasMethod,
    hasMethods:hasMethods
}