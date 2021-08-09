const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize=require('../Db');

const RegisterUser = sequelize.define('registerUser', {
    id: { type: DataTypes.INTEGER, primaryKey: true,autoIncrement:true },
    // 在这里定义模型属性
    username: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment:'user name'
    },

    password: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment:'password'
    },

    email: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment:'email'
    },

    telphone: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment:'telphone'
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
module.exports = RegisterUser;

