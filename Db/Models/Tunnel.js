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

    localIp: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'local ip',
        unique: 'uniqueTag'
    },

    localPort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'local name',
        unique: 'uniqueTag'
    },

    remotePort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'local name',
        unique: 'uniqueTag'
    },

    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'created time',
        defaultValue: Sequelize.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'updated time',
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

