const Client = require('./Models/Client');
const Tunnel = require('./Models/Tunnel');
const RegisterUser = require('./Models/RegisterUser');

RegisterUser.Clients=RegisterUser.hasMany(Client);
Client.RegisterUser=Client.belongsTo(RegisterUser);

Tunnel.Client=Tunnel.belongsTo(Client);
Client.Tunnels=Client.hasMany(Tunnel);

//require('./Db').sync({force:true});
//require('./Db').sync({alter:true});
module.exports={
    Client,
    Tunnel,
    RegisterUser
}