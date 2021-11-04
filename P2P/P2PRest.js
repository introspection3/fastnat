const Interface = require('../Common/Interface');
const P2PRestInterface = require('./P2PRestInterface');

const axios = require('axios').default;


class P2PRest {
    constructor(authenKey) {
        Interface.ensureImplements(this, P2PRestInterface);
        this.authenKey = authenKey;
    }
    async getTunnelP2PInfoAsync(tunnelId, password) {
        let url = '/tunnel/api/getP2PInfo';
        let result = await (await axios.get(url, { params: { tunnelId: tunnelId, password: password, authenKey: this.authenKey } })).data;
        return result;
    }
}
module.exports = P2PRest;