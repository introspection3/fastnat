
/**
 * create a interface
 * 
 * @param {string} name interface's name
 * @param {Array<string>} methods interface's methods 
 */
function createInterface(name, ...methods) {
    if (methods.length == 0) {
        throw new Error('this interface must have a  method');
    }
    this.name = name;
    this.methods = [];
    this.isInterface = true;
    for (let i = 0; i < methods.length; i++) {
        if (typeof methods[i] !== 'string') {
            throw new Error(`method's name must be string`);
        }
        this.methods.push(methods[i]);
    }
}


/**
 * ensure a object implementing one interface or more interfaces
 * @param {object} targetObject 
 * @param  {...object} interfaces
 * 
 */
function ensureImplements(targetObject, ...interfaces) {
    if (interfaces.length == 0) {
        throw new Error('interfaces at lest one');
    }
    for (var i = 0; i < interfaces.length; i++) {
        let interfacetmp = interfaces[i];
        if (interfacetmp.isInterface === true) {
            for (j = 0; j < interfacetmp.methods.length; j++) {
                let methodName = interfacetmp.methods[j];
                let targetObjectMethod=targetObject[methodName];
                if (!targetObjectMethod || typeof targetObjectMethod != 'function') {
                    throw new Error(`method(${methodName}) is not implement in target Object`);
                }
            }
        } else {
            throw new Error(JSON.stringify(interfacetmp) + ' is not Interface');
        }
    }
    return true;
}



let Interface = {
    createInterface: createInterface,
    ensureImplements: ensureImplements
}

module.exports = Interface;