const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db');
const Tunnel = sequelize.define('tunnel', {

    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'tunnel type'
    },

    lowProtocol: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'tcp',
        comment: 'low protocol',
    },

    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'tunnel name'
    },

    other: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'other config',
        defaultValue: ''
    },

    p2pPassword: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'p2p password',
        defaultValue: 'fastnat'
    },

    localIp: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'local ip'
    },

    localPort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'local port'

    },

    remotePort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'remote port',
    },

    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'create time',
        defaultValue: Sequelize.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'update time',
        defaultValue: Sequelize.NOW
    },
    isAvailable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'is available'
    },
    clientId: {
        type: Sequelize.INTEGER,
        references: {
            model: 'clients', //  refers to table name
            key: 'id', //  refers to column name in fathers table
        }
    },
    uniqueName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'unique server name(domain name eg.)',
    }
}, {
    indexes: [{
            name: 'unique_name_for_client',
            unique: true,
            fields: ['name', 'clientId']
        },
        {
            name: 'unique_port_for_server',
            unique: true,
            fields: ['remotePort', 'lowProtocol']
        },
        {
            name: 'unique_uniqueName',
            unique: true,
            fields: ['uniqueName']
        },
        {
            name: 'unique_loalAddress_for_client',
            unique: true,
            fields: ['localIp', 'localPort', 'clientId', 'lowProtocol']
        },
    ]
});
module.exports = Tunnel;