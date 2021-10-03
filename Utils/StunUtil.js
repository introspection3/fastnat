const getNatType = require("nat-type-identifier");

async function getNatType2(sampleCount, stunHost) {
    let currentClientNatType = 'Unkown';
    try {
        currentClientNatType = await getNatType({ logsEnabled: false, sampleCount: sampleCount, stunHost: stunHost });
    } catch (error) {
        logger.warn(error);
        currentClientNatType = 'Error';
    }
    return currentClientNatType;
}


module.exports = async({ sampleCount, stunHost }) => {
    console.log(sampleCount, stunHost);
    return await getNatType2(sampleCount, stunHost);
};