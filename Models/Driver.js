const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
    name: String,
    mobileNumber: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'driver' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsHead' },
    passwordResetRequired: { type: Boolean, default: true },
    image: { type: String, default: 'https://i.postimg.cc/43CsrrKY/Screenshot-2024-09-07-at-6-08-52-PM.png' },
});
module.exports = mongoose.model('Driver', DriverSchema);
