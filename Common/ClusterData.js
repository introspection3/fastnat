const cluster = require('cluster');
const serverConfig = require('./ServerConfig');
const clusterEnabled = serverConfig.cluster.enabled;
const masterLocalMap = new Map();
const { v4: uuidv4 } = require('uuid');
const events = require('events');
const logger = require('../Log/logger');
const eventEmitter = new events.EventEmitter();

function register2Cluster() {
    for (const id in cluster.workers) {
        let targetWorker = cluster.workers[id];
        targetWorker.on('message', message => {
           
            if (message.messageType === 'clusterSet') {
                masterLocalMap.set(message.name, message.value);
                let fromWorker = cluster.workers[message.workerId];
                if (fromWorker != null) {
                    fromWorker.send({ messageType: 'clusterSet_Result', result: true, mid: message.mid });
                }
                return;
            }

            if (message.messageType === 'clusterGet') {
                let value = masterLocalMap.get(message.name);
                let fromWorker = cluster.workers[message.workerId];
                if (fromWorker != null) {
                    fromWorker.send({ messageType: 'clusterGet_Result', result: value, mid: message.mid });
                }
                return;
            }


            if (message.messageType === 'clusterDelete') {
                let value = masterLocalMap.delete(message.name);
                let fromWorker = cluster.workers[message.workerId];
                if (fromWorker != null) {
                    fromWorker.send({ messageType: 'clusterDelete_Result', result: value, mid: message.mid });
                }
                return;
            }

            if (message.messageType === 'clusterExist') {
                let value = masterLocalMap.has(message.name);
                let fromWorker = cluster.workers[message.workerId];
                if (fromWorker != null) {
                    fromWorker.send({ messageType: 'clusterExist_Result', result: value, mid: message.mid });
                }
                return;
            }
        }

        );
    }

    return;
}

function register2Worker() {
    process.on('message', message => {
        
        if (message.messageType === 'clusterSet_Result') {
            eventEmitter.emit(message.mid, message.result);
            return;
        }
        if (message.messageType === 'clusterGet_Result') {
            eventEmitter.emit(message.mid, message.result);
            return;
        }
        if (message.messageType === 'clusterDelete_Result') {
            eventEmitter.emit(message.mid, message.result);
            return;
        }
        if (message.messageType === 'clusterExist_Result') {
            eventEmitter.emit(message.mid, message.result);
            return;
        }
    });
}

function setAsync(name, value) {
    if (clusterEnabled) {
        clusterSet(name, value);
    } else {
        masterLocalMap.set(name, value);
        let p = new Promise((resolve, reject) => {
            resolve(true);
        });
        return p;
    }
}

function clusterSet(name, value) {
    if (cluster.isMaster || cluster.isPrimary) {
        masterLocalMap.set(name, value);
        let p = new Promise((resolve, reject) => {
            resolve(true);
        });
        return p;
    } else {
        let mid = uuidv4();
        process.send({ messageType: 'clusterSet', name: name, value: value, workerId: cluster.worker.id, mid: mid });
        let p = new Promise((resolve, reject) => {
            let t = setTimeout(() => {
                reject('clusterSet timeout:');
            }, 100);

            eventEmitter.once(mid, (result) => {
                clearTimeout(t);
                resolve(result);
            });
        });
        return p;
    }
}

function clusterGet(name) {
    if (cluster.isMaster || cluster.isPrimary) {
        let result = masterLocalMap.get(name);
        let p = new Promise((resolve, reject) => {
            resolve(result);
        });
        return p;
    } else {
        let mid = uuidv4();
        process.send({ messageType: 'clusterGet', name: name, workerId: cluster.worker.id, mid: mid });
        let p = new Promise((resolve, reject) => {
            let t = setTimeout(() => {
                reject('clusterSet timeout:');
            }, 100);

            eventEmitter.once(mid, (result) => {
                clearTimeout(t);
                resolve(result);
            });
        });
        return p;
    }
}

function getAsync(name) {
    if (clusterEnabled) {
        return clusterGet(name);
    } else {
        let result = masterLocalMap.get(name);
        let p = new Promise((resolve, reject) => {
            resolve(result);
        });
        return p;
    }
}

function clusterExist(name) {
    if (cluster.isMaster || cluster.isPrimary) {
        let result = masterLocalMap.has(name);
        let p = new Promise((resolve, reject) => {
            resolve(result);
        });
        return p;
    } else {
        let mid = uuidv4();
        process.send({ messageType: 'clusterExist', name: name, workerId: cluster.worker.id, mid: mid });
        let p = new Promise((resolve, reject) => {
            let t = setTimeout(() => {
                reject('clusterExist timeout:');
            }, 100);

            eventEmitter.once(mid, (result) => {
                clearTimeout(t);
                resolve(result);
            });
        });
        return p;
    }
}

async function existAsync(name) {
    if (clusterEnabled) {
        return clusterExist(name);
    } else {
        let result = masterLocalMap.has(name);
        let p = new Promise((resolve, reject) => {
            resolve(result);
        });
        return p;
    }
}


function clusterDelete(name) {
    if (cluster.isMaster || cluster.isPrimary) {
        let result = masterLocalMap.delete(name);
        let p = new Promise((resolve, reject) => {
            resolve(result);
        });
        return p;
    } else {
        let mid = uuidv4();
        process.send({ messageType: 'clusterDelete', name: name, workerId: cluster.worker.id, mid: mid });
        let p = new Promise((resolve, reject) => {
            let t = setTimeout(() => {
                reject('clusterDelete timeout:');
            }, 100);

            eventEmitter.once(mid, (result) => {
                clearTimeout(t);
                resolve(result);
            });
        });
        return p;
    }
}

function deleteAsync(name) {
    if (clusterEnabled) {
        return clusterDelete(name);
    } else {
        let result = masterLocalMap.delete(name);
        let p = new Promise((resolve, reject) => {
            resolve(result);
        });
        return p;
    }
}
module.exports.register2Cluster = register2Cluster;
module.exports.register2Worker = register2Worker;
module.exports.getAsync = getAsync;
module.exports.setAsync = setAsync;
module.exports.existAsync = existAsync;
module.exports.deleteAsync = deleteAsync;