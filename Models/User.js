const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    phoneNumber: String,
    password: String,
    role: { type: String, default: 'logistics_head' },
    companyName: String,
    image: { type: String, default: 'https://i.postimg.cc/43CsrrKY/Screenshot-2024-09-07-at-6-08-52-PM.png' },
    
});

module.exports = mongoose.model('User', UserSchema);
