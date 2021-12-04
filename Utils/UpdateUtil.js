const os = require('os');
const http = require('http');
const fs = require('fs');
const readFile = fs.promises.readFile;
const path = require('path');
const GlobalData = require('../Common/GlobalData');
const axios = require('axios');

function downloadFileAsync(uri, dest) {
    return new Promise((resolve, reject) => {
        // 确保dest路径存在
        const file = fs.createWriteStream(dest);
        http.get(uri, (res) => {

            if (res.statusCode !== 200) {
                reject(response.statusCode);
                return;
            }

            res.on('end', () => {
                console.log('download end');
            });

            // 进度、超时等

            file.on('finish', () => {
                console.log('finish write file');
                file.close(resolve);
            }).on('error', (err) => {
                fs.unlink(dest);
                reject(err.message);
            });

            res.pipe(file);
        });
    });
}

async function getClientConfigAsync() {
    const clientConfigPath = path.join(GlobalData.rootPath, "config", 'client.json');
    let json = await readFile(clientConfigPath);
    let clientConfig = JSON.parse(json);
    return clientConfig;
}
async function checkAsync(version = GlobalData.version) {
    let clientConfig = await getClientConfigAsync();
    let url = `${clientConfig.serverUrl}/update/api/check?platform=${os.platform()}&version=${version}&arch=${os.arch()}`;
    let data = await (await axios.default.get(url)).data;
    return data;
}

async function downUpdatePackageIfExist() {
    let result = await checkAsync();
    if (result.data.canUpdate) {
        let downFileSavePath = path.join(GlobalData.rootPath, "pkg.zip");
        await downloadFileAsync(`${result.data.url}`, downFileSavePath);
    }
}

module.exports = {
    downUpdatePackageIfExist
}