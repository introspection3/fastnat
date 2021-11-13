const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db');
let primaryDataType = DataTypes.BIGINT;
if (sequelize.getDialect() === 'sqlite') {
    primaryDataType = DataTypes.INTEGER;
}
const RegisterUser = sequelize.define('registerUser', {

    id: { type: primaryDataType, primaryKey: true, autoIncrement: true },

    username: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment: 'user name',
        validate: {
            len: [2, 50]
        }
    },
    userType: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'normal',
        comment: 'user type',
    },
    password: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'password',
        validate: {
            len: [6, 150]
        }
    },

    email: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment: 'email',
        validate: {
            isEmail: true,
            len: [5, 150]
        }
    },

    telphone: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        comment: 'telphone',
        validate: {
            len: [7, 50]
        }
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
            name: 'unique_username',
            unique: true,
            fields: ['username']
        },
        {
            name: 'unique_email',
            unique: true,
            fields: ['email']
        },
        {
            name: 'unique_telphone',
            unique: true,
            fields: ['telphone']
        },
    ]
});
module.exports = RegisterUser;