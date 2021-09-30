var ffi = require('ffi-napi');


var iconv = require("iconv-lite");
var str = "中文不乱码" + "\0";
var rawStr = iconv.encode(str, 'GBK');

var Test = ffi.Library('user32.dll', {
    'MessageBoxA': ['int', ['int', 'string', 'string', 'int']]
});
console.log(rawStr);
Test.MessageBoxA(0, rawStr, rawStr, 0);