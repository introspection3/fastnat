
/**
 * Tcp Rpc Client Protocal Data
 */
class RpcClientProtocal {

    constructor(props) {
        if (typeof props == undefined)
            props = {};
        this.method = props.method;
        this.args = props.args;
        this.uuid = props.uuid;
    }
}

/**
 * Tcp Rpc Client Protocal Data
 */

class RpcServerProtocal {

    constructor(props) {
        if (typeof props == undefined)
            props = {};
        this.result = props.result;
        this.uuid = props.uuid;
    }
}

module.exports = {
    RpcServerProtocal: RpcServerProtocal,
    RpcClientProtocal: RpcClientProtocal
};