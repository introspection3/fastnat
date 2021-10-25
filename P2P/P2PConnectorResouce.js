 class P2PConnectorResouce {
     constructor(connectorId) {
         this.TcpServer = null;
         this.ResSet = new Set();
         this.ConnectorId = connectorId;
     }
     addRes(res) {
         this.ResSet.add(res);
     }
     deleteRes(res) {
         this.ResSet.delete(res);
     }
     destoryAllRes() {
         if (this.TcpServer) {
             this.TcpServer.close();
             this.TcpServer = null;
         }
         this.ResSet.forEach(function(item) {
             item.UtpClient.close();
             item.TcpSocket.end();
             item.TcpSocket.destory();
         })
         this.ResSet.clear();
     }
     stop() {
         this.destoryAllRes();
     }
 }
 module.exports = P2PConnectorResouce;