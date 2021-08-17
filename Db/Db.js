const { Sequelize } = require("sequelize");
const logger = require('../Log/logger');
const config = require('../Common/ServerConfig');
const dbConfig = config.db;

if (dbConfig.dbType === 'sqlite') {
    
    const sqlite = require('sqlite3');
    const GlobalData = require('../Common/GlobalData');
    const sqliteFilePath = GlobalData.rootPath + "/config/database.db";
    const fs = require('fs');
    let exist = fs.existsSync(sqliteFilePath);
    if (exist == false) {
        let db = new sqlite.Database(sqliteFilePath, err => {
            if (err) {
                logger.log("create database error,", err.message);
            } else {
                logger.log("create database success")
            };
        });
        db.close();
    }
    let db = new sqlite.Database(sqliteFilePath, err => {
        if (err) {
            logger.log("create database error,", err.message);
        } else {
            logger.log("create database success")
        };
    });
    db.close();
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: sqliteFilePath,
        logging: dbConfig.logging
    });
   
    module.exports = sequelize;
} else {
    const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
        host: dbConfig.host,
        dialect: dbConfig.dbType,
        logging: dbConfig.logging
    });
    
    module.exports = sequelize;
}


