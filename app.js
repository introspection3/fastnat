'use strict';
const Koa = require('koa');
const app = new Koa();

app.use( async ctx  => {
  ctx.body = 'Hello World';
})

app.listen(1080,()=>{
  console.log("server is running at 3000 port");
})