const getNatType = require("nat-type-identifier");

const params = { logsEnabled: false, sampleCount: 5, p2pHost: "stun.sipgate.net" };

const whatsMyNat = async() => {
    const result = await getNatType(params);
    console.log("Result: ", result); // Outputs NAT type
    return result;
};

whatsMyNat();