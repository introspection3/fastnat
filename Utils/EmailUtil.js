const nodemailer = require("nodemailer");
const serverConfig = require('../Common/ServerConfig');
const emailConfig = serverConfig.email;

const transporter = nodemailer.createTransport(emailConfig);

async function sendMailAsync(to, subject, html, from = emailConfig.auth.user) {
    let info = await transporter.sendMail({
        from: from,
        to: to,
        subject: subject,
        html: html,
    });
    return info;
}


module.exports = {
    transporter,
    sendMailAsync
}