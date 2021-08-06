const express = require('express'); 
const app = express();
app.use('/public', express.static('public'));
const Client = require('./Db/Models/Client');

app.get('/', function (req, res) {
  Client.create({ authenKey: new Date().toString(), isAvailable: true }).then(data => {
    res.send(data);
  })
});

app.post('/client/register', function (req, res) {
  res.send({});

});

app.get('/client/allconfig', function (req, res) {  
  res.send({});
});


let server = app.listen(8081, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("server start: http://%s:%s", host, port);
});