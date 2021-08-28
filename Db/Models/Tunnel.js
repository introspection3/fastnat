const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db');
const Tunnel = sequelize.define('tunnel', {

    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'tunnel type'
    },

    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'tunnel name'
    },

    p2pRemotePort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: -1,
        comment: 'p2p remote port'
    },

    p2pRemotePortUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'p2p remote port UpdatedAt time',
        defaultValue: Sequelize.NOW
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
        comment: 'local ip',
        unique: 'uniqueTag'
    },

    localPort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'local port',
        unique: 'uniqueTag'
    },

    remotePort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'remote port',
        unique: 'uniqueTag'
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
    }
}, {

});
module.exports = Tunnel;

