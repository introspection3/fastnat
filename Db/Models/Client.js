const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize=require('../Db');
const Client = sequelize.define('client', {

    id: { type: DataTypes.INTEGER, primaryKey: true,autoIncrement:true },

    // 在这里定义模型属性
    authenKey: {
        type: DataTypes.STRING(250),
        unique: true,
        allowNull: false,
        comment:'authen Key'
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
module.exports = Client;

