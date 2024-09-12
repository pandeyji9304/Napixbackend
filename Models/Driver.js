const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
    name: String,
    mobileNumber: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'driver' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsHead' },
    passwordResetRequired: { type: Boolean, default: true }
});
module.exports = mongoose.model('Driver', DriverSchema);
