const Client = require('./Models/Client');
const Tunnel = require('./Models/Tunnel');
const RegisterUser = require('./Models/RegisterUser');

RegisterUser.Clients=RegisterUser.hasMany(Client,{ onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Client.RegisterUser=Client.belongsTo(RegisterUser);

Tunnel.Client=Tunnel.belongsTo(Client);
Client.Tunnels=Client.hasMany(Tunnel,{ onDelete: 'CASCADE', onUpdate: 'CASCADE' });


module.exports={
    Client,
    Tunnel,
    RegisterUser
}