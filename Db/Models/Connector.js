const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db');

const Connector = sequelize.define('connector', {

    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Connector name'
    },

    p2pTunnelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: -1,
        comment: 'p2p tunnel id'
    },

    p2pPassword: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'p2p password',
        defaultValue: 'fastnat'
    },
    localPort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'local port',
        defaultValue:0,
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
module.exports = Connector;

