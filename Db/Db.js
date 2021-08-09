const { Sequelize, Op, Model, DataTypes } = require("sequelize");
//const sqlite = require('sqlite3');
const GlobalData = require('../Common/GlobalData');
const sqliteFilePath = GlobalData.rootPath + "/database.db";

const fs = require('fs');

fs.exists(sqliteFilePath, (exist) => {
    if (exist == false) {
     //   let db = new sqlite.Database(sqliteFilePath);
    }
})

// const sequelize = new Sequelize({
//     dialect: 'sqlite',
//     storage: sqliteFilePath,
//     define: {
//         freezeTableName: true
//     }
// });

const sequelize = new Sequelize('database', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql',
    logging:false
 }
 ,
 
 );

module.exports = sequelize;

