 const CryptoJS = require("crypto-js");
 const key = CryptoJS.enc.Utf8.parse('1A11111111111111'); //密钥必须是16位，且避免使用保留字符

 function encrypt(content) {
     let encryptedData = CryptoJS.AES.encrypt(content, key, {
         mode: CryptoJS.mode.ECB,
         padding: CryptoJS.pad.Pkcs7
     });
     let hexData = encryptedData.ciphertext.toString();
     return hexData;
 }

 function decrypt(hexData) {
     let encryptedHexStr = CryptoJS.enc.Hex.parse(hexData);
     let encryptedBase64Str = CryptoJS.enc.Base64.stringify(encryptedHexStr);
     let decryptedData = CryptoJS.AES.decrypt(encryptedBase64Str, key, {
         mode: CryptoJS.mode.ECB,
         padding: CryptoJS.pad.Pkcs7
     });
     let text = decryptedData.toString(CryptoJS.enc.Utf8);
     return text;
 }

 module.exports = {
     encrypt: encrypt,
     decrypt: decrypt
 }