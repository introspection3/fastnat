const express = require('express');
const { RegisterUser,Client } = require('./Db/Models');
const app = express();
app.use('/public', express.static('public'));
const { v4: uuidv4 } = require('uuid');

app.get('/', async function (req, res) {
  let user = await RegisterUser.create(data);
  let client=await Client.create({
    authenKey:uuidv4(),
    registerUserId:user.id
  });
  res.send(client);
});

app.post('/user/register', async function (req, res) {
  let user = await RegisterUser.create(req.body);
  let client=await Client.create({
    authenKey:uuidv4(),
    registerUserId:user.id
  });
  res.send(client);
});

app.get('/client/allconfig', async function (req, res) {
  let tunnels=await Client.findAll({
    where:{
      authenKey:req.params.authenKey
    }
  })
  res.send(tunnels);
});


let server = app.listen(8081, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("server start: http://%s:%s", host, port);
});