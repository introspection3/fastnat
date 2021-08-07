'use strict';

const logger = require('../Log/logger');
const net = require('net');
const TcpClient = require('../Tcp/TcpClient');
const TcpTunnelProtocal = require('../TcpTunnel/TcpTunnelProtocal');
const { Socket } = require('dgram');
/**
 * Tcp隧道服务端程序
 */
class TcpTunnelClient {

    /**
     * 
     * @param {Object} serverAddress 
     * @param {Object} localAddress 
     */
    constructor(authenKey, serverAddress, localAddress) {
        this.authenKey = authenKey
        this.serverAddress = serverAddress;
        this.localAddress = localAddress;
        this.started = false;
        this.defaultTimeout = 5000;
    }

    /**
     * 
     * @param {Object} address 
     * @returns {Promise<net.Socket>}
     */
    connect2TcpServer(address) {

        // 创建用于连接校验服务端的 客户端连接
        let client = net.createConnection(address, () => {
            logger.info('Tcp client has created');
        });

        client.on('connect', () => {
            logger.info('Tcp client has connected to ' + JSON.stringify(address));

        });

        client.on('data', (dataBuffer) => {
            
        });

        client.on('close', (hadError) => {
            logger.info('Tcp Client Closed:' + JSON.stringify(address))
        });

        let p = new Promise((resolve, reject) => {
            let t = setTimeout(() => {
                reject('connect timeout:' + this.defaultTimeout)
            }, this.defaultTimeout);

            client.on('connect', () => {
                clearTimeout(t);
                resolve(client);
            });
        });

        return p;
    }

    /*启动Tcp隧道客户端程序,只会调用一次
    * 连接到服务端
     */
    async start() {
        
        if (this.started) {
            logger.warn("TcpTunnelClient has already started.");
            return;
        }
        this.started = true;

        let localSocket = await this.connect2TcpServer(this.localAddress);
        let remoteSocket = await this.connect2TcpServer(this.serverAddress);
        localSocket.pipe(remoteSocket);
        remoteSocket.pipe(localSocket);

    }


    closeClient(data, socket) {
        logger.warn('recevie command (closeClient)' + data.info);
        this.tcpClient.client.end();
    }

    clientInfo(data, socket) {
        logger.info(data);

    }

}

module.exports = TcpTunnelClient;