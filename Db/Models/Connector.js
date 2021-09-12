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
        comment: 'p2p tunnel id',
        references: {
            model: 'tunnels', //  refers to table name
            key: 'id', //  refers to column name in fathers table
        }
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
        defaultValue: 0,
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
    }
}, {
    indexes: [
        {
            name: 'unique_connetctor_name_for_client',
            unique: true,
            fields: ['name','clientId']
        }
       
    ]
});
module.exports = Connector;

