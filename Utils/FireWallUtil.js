const os = require('os');
const ExecUtil = require('./ExecUtil');

async function addProgramExceptionAsync(ruleName, processPath) {
    if (os.platform() === 'win32') {
        let cmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow program="${processPath}" enable=yes`;
        return await ExecUtil.execute(cmd);
    } else {
        return 'not implement';
    }
}

async function addCurrentProgramExceptionAsync(ruleName) {
    if (os.platform() === 'win32') {
        let processPath = process.argv0;
        return await addProgramExceptionAsync(ruleName, processPath);
    } else {
        return 'not implement';
    }
}

async function addPortAsync(ruleName, protocol, localport) {
    if (os.platform() === 'win32') {
        let cmd = `netsh advfirewall firewall add rule name="${ruleName}" protocol=${protocol} dir=in localport=${localport} action=allow`;
        return await ExecUtil.execute(cmd);
    } else {
        return 'not implement';
    }
}
async function allowIcmpAsync() {
    if (os.platform() === 'win32') {
        let cmd = `netsh advfirewall firewall add rule name="ICMP Allow incoming V4 echo request" protocol=icmpv4:8,any dir=in action=allow`;
        return await ExecUtil.execute(cmd);
    } else {
        return 'not implement';
    }
}
async function disableIcmpAsync() {
    if (os.platform() === 'win32') {
        let cmd = `netsh advfirewall firewall add rule name="ICMP Allow incoming V4 echo request" protocol=icmpv4:8,any dir=in action=block`;
        return await ExecUtil.execute(cmd);
    } else {
        return 'not implement';
    }
}
module.exports = {
    allowIcmpAsync,
    disableIcmpAsync,
    addPortAsync: addPortAsync,
    addProgramExceptionAsync: addProgramExceptionAsync,
    addCurrentProgramExceptionAsync: addCurrentProgramExceptionAsync
}