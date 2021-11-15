const getNatType = require("nat-type-identifier");

async function getNatType2(sampleCount, p2pHost) {
    let currentClientNatType = 'Unkown';
    try {
        currentClientNatType = await getNatType({ logsEnabled: false, sampleCount: sampleCount, p2pHost: p2pHost });
    } catch (error) {
        logger.warn(error);
        currentClientNatType = 'Error';
    }
    return currentClientNatType;
}


module.exports = async({ sampleCount, p2pHost }) => {
    return await getNatType2(sampleCount, p2pHost);
};