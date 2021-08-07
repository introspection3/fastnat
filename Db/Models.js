const Client = require('./Models/Client');
const Tunnel = require('./Models/Tunnel');
const RegisterUser = require('./Models/RegisterUser');

RegisterUser.hasMany(Client);
Client.belongsTo(RegisterUser);

Tunnel.belongsTo(Client);
Client.hasMany(Tunnel);

//require('./Db').sync({force:true});
require('./Db').sync({alter:true});
module.exports={
    Client,
    Tunnel,
    RegisterUser
}