
const logger=require('../Log/logger');
const headBytesCount = 4;

/**
 * 对发送的buffer数据进行打包
 * @param {Buffer} dataBuffer 
 * @returns Buffer
 */
function packData(dataBuffer) {
    let head = Buffer.alloc(headBytesCount);
    head.writeUInt32BE(dataBuffer.byteLength, 0);
    return Buffer.concat([head, dataBuffer]);
}

/**
 * 对发送的buffer数据进行解包
 * @param {Buffer} dataBuffer 
 * @returns [success,body]
 */
function unPackData(dataBuffer) {
    let head =  dataBuffer.slice(0,headBytesCount); 
    let dataLen = head.readUInt32BE();
    if(dataLen+headBytesCount!=dataBuffer.length){
        logger.error(`unPackData dataBuffer'length is wrong`);
        return [false,null]
    }
    let body =dataBuffer.slice(headBytesCount);
    return [true,body]
}

module.exports={
    packData:packData,
    unPackData:packData
}