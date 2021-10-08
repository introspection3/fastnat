const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db');
const Client = sequelize.define('client', {

    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // 在这里定义模型属性
    authenKey: {
        type: DataTypes.STRING(250),
        unique: true,
        allowNull: false,
        comment: 'authen Key'
    },

    clientName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '',
        comment: 'client name'
    },
    os: {
        type: DataTypes.STRING(500),
        allowNull: false,
        defaultValue: '{}',
        comment: 'client os info'
    },

    publicIp: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '',
        comment: 'client public ip'
    },

    mac: {
        type: DataTypes.STRING(250),
        allowNull: false,
        defaultValue: '',
        comment: 'client mac'
    },
    natType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '',
        comment: 'client nat type'
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
    indexes: [{
        name: 'unique_name_for_user',
        unique: true,
        fields: ['clientName', 'registerUserId']
    }]
});
module.exports = Client;