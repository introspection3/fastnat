const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db');
let primaryDataType = DataTypes.BIGINT;
if (sequelize.getDialect() === 'sqlite') {
    primaryDataType = DataTypes.INTEGER;
}
const Client = sequelize.define('client', {

    id: { type: primaryDataType, primaryKey: true, autoIncrement: true },

    // 在这里定义模型属性
    authenKey: {
        type: DataTypes.STRING(250),
        unique: true,
        allowNull: false,
        comment: 'authen Key'
    },
    status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'client status',
        defaultValue: 0,
    },
    clientName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '',
        comment: 'client name'
    },
    hostName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '',
        comment: 'host name'
    },
    arch: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: '',
        comment: 'arch'
    },
    osReleaseVersion: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '',
        comment: 'os release version'
    },
    os: {
        type: DataTypes.STRING(500),
        allowNull: false,
        defaultValue: '{}',
        comment: 'client os info'
    },
    platform: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: '',
        comment: 'os platform'
    },
    version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '',
        comment: 'client version'
    },
    publicIp: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '',
        comment: 'client public ip'
    },
    virtualIp: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '',
        comment: 'client virtual ip'
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
        },
        {
            name: 'unique_vip',
            unique: true,
            fields: ['virtualIp']
        }
    ]
});
module.exports = Client;