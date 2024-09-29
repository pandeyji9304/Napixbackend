const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    phoneNumber: String,
    password: String,
    role: { type: String, default: 'logistics_head' },
    companyName: String,
    image: { type: String, default: true },
    
});

module.exports = mongoose.model('User', UserSchema);
