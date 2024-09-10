const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
    name: String,
    mobileNumber: String,
    email: { type: String, unique: true },
    password: String,
    companyId: mongoose.Schema.Types.ObjectId,
});
module.exports = mongoose.model('Driver', DriverSchema);
