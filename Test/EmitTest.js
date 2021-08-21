const events=require('events');
let eventEmitter=new events.EventEmitter();
eventEmitter.on('msg',msg=>{
    console.log('on=>',msg);
});
eventEmitter.once('msg',msg=>{
    console.log('once=>',msg);
});
setInterval(() => {
    eventEmitter.emit('msg',new Date());
}, 2000);