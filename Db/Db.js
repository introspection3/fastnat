const { Sequelize } = require("sequelize");
const logger = require('../Log/logger');
const serverConfig = require('../Common/ServerConfig');
const dbConfig = serverConfig.db;


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
        logging: sql => {
            if (dbConfig.logging) {
                console.log(sql);
            }
        },
        // timezone: '+08:00'
    });

    module.exports = sequelize;
} else {
    const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
        host: dbConfig.host,
        dialect: dbConfig.dbType,
        dialectOptions: {
            supportBigNumbers: true
        },
        logging: sql => {
            if (dbConfig.logging) {
                console.log(sql);
            }
        },
        timezone: '+08:00'
    });

    module.exports = sequelize;
}