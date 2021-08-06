const Client = require('./Models/Client');
const Tunnel = require('./Models/Tunnel');
Tunnel.belongsTo(Client);
Client.hasMany(Tunnel);

//require('./Db').sync({force:true});
module.exports={
    Client,
    Tunnel
}