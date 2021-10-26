const commandType = {
    P2P_REQUEST_OPEN: 'p2p.request.open',
    START_TUNNEL: 'start.tunnel',
    ADD_TUNNEL: 'add.tunnel',
    DELETE_TUNNEL: 'delete.tunnel',
    STOP_TUNNEL: 'stop.tunnel',
    DELETE_CLIENT: 'delete.client',
    ADD_CLIENT: 'add.client',
    DELETE_CONNECTOR: 'delete.connector',
    ADD_CONNECTOR: 'add.connector',
    UPDATE_CONNECTOR: 'update.connector',
    START_CONNECTOR: 'start.connector',
    CLIENT_CREATE_UDP_TUNNEL_SERVER: 'client.createUpdTunnelServer',
    CLIENT_STOP_UDP_TUNNEL_SERVER: 'client.stopUpdTunnelServer'
}
module.exports.commandType = commandType;