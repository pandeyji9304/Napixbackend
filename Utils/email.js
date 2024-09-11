const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'famousedit9304@gmail.com',
        pass: 'your-email-password',
    },
});

const sendEmail = (to, subject, text) => {
    const mailOptions = {
        from: 'famousedit9304@gmail.com',
        to,
        subject,
        text,
    };

    return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
