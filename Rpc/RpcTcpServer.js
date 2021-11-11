'use strict';

const logger = require('../Log/logger');
const net = require('net');
const events = require('events');
const TcpServer = require('../Tcp/TcpServer');
const { RpcClientProtocal, RpcServerProtocal } = require('./RpcProtocal');
const path = require('path');
const rootPath = require('../Common/GlobalData').rootPath;
const commandType = require('../Communication/CommandType').commandType;
/**
 * Tcp隧道服务端程序
 */
class RpcTcpServer {

    /**
     * 
     * @param {object} tcpServerConfig 
     * @param {SocketIO.Namespace<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>} defaultNS 
     * @param {string} serverSignature 
     */
    constructor(tcpServerConfig, defaultNS, serverSignature) {
        this.serverSignature = serverSignature;
        this.tcpServer = new TcpServer(tcpServerConfig);
        this.defaultNS = defaultNS;
    }



    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        this.tcpServer.start();

        this.tcpServer.eventEmitter.on('onMessage', (dataBuffer, socket) => {

        });

        this.tcpServer.eventEmitter.on('onCodecMessage', (data, socket) => {
            if (data.serverSignature === this.serverSignature) {
                this[data.method](...data.args, data.uuid, socket);
            }
        });
    }

    fn(result, uuid, socket) {
        let response = new RpcServerProtocal({});
        response.result = result;
        response.uuid = uuid;
        this.tcpServer.sendCodecData2OneClient(response, socket);
    }

    async p2pOpenRequest(data, uuid, socket) {

        let targetClientId = data.targetClientId;
        let result = false;
        let info = '';
        let allSockets = await this.defaultNS.fetchSockets();
        let targetSocket = allSockets.find((value, index, array) => {
            return value.handshake.auth.clientId === targetClientId;
        });

        if (targetSocket != null) {
            result = true;
            logger.trace('start to notify targe socket to open p2p');
            targetSocket.emit(commandType.P2P_REQUEST_OPEN, data, (ret) => {

                this.fn(ret, uuid, socket);
            });
        } else {
            info = `targetTunnelId's client is not online:targetClientId=` + targetClientId;
            this.fn({ success: result, data: data, info: info }, uuid, socket);
        }
    }


}

module.exports = RpcTcpServer;