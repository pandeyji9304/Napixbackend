const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
    vehicleNumber: { type: String, unique: true },
    companyId: mongoose.Schema.Types.ObjectId,
});

module.exports = mongoose.model('Vehicle', VehicleSchema);
