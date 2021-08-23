const stun = require('stun');

stun.request('stun.l.google.com:19302', (err, res) => {
    if (err) {
        console.error(err);
    } else {
        const { address } = res.getXorAddress();
        console.log('your ip', address);
    }
});

// or with promise
async function test(params) {
    const res = await stun.request('stun.l.google.com:19302');
    console.log('your ip', res.getXorAddress());
}
test();
