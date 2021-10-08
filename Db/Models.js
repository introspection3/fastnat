const Client = require('./Models/Client');
const Tunnel = require('./Models/Tunnel');
const RegisterUser = require('./Models/RegisterUser');
const Connector = require('./Models/Connector');

RegisterUser.Clients = RegisterUser.hasMany(Client, { onDelete: 'CASCADE', onUpdate: 'CASCADE', constraints: true });
Client.RegisterUser = Client.belongsTo(RegisterUser, { foreignKey: { field: 'userId' } });

Tunnel.Client = Tunnel.belongsTo(Client);
Client.Tunnels = Client.hasMany(Tunnel, { onDelete: 'CASCADE', onUpdate: 'CASCADE' });


Connector.Client = Connector.belongsTo(Client);
Client.Connectors = Client.hasMany(Connector, { onDelete: 'CASCADE', onUpdate: 'CASCADE' });


Connector.Tunnel = Connector.belongsTo(Tunnel, { foreignKey: { field: 'p2pTunnelId' } });
Tunnel.Connectors = Tunnel.hasMany(Connector, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    constraints: true

});

module.exports = {
    Client,
    Tunnel,
    RegisterUser,
    Connector
}