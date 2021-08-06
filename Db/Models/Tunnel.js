const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize=require('../Db');
const Tunnel = sequelize.define('tunnel', {
    // 在这里定义模型属性
    type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment:'tunnel type'
    },

    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment:'tunnel name'
    },
    localIp: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment:'local ip'
    },

    localPort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment:'local name'
    },

    remotePort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment:'local name'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment:'created time',
        defaultValue: Sequelize.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment:'updated time',
        defaultValue: Sequelize.NOW
    },
    isAvailable: { 
        type: DataTypes.BOOLEAN, 
        allowNull: false, 
        defaultValue: true,
        comment:'is available'
    }
}, {
    // 这是其他模型参数
});
module.exports = Tunnel;

