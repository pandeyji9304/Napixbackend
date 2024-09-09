const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
    vehicleNumber: { type: String, required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    fromLocation: { type: String, required: true },
    toLocation: { type: String, required: true },
    departureDetails: { type: Date, required: true },
    passKey: { type: String, required: true }, // Truck number as pass key
});

module.exports = mongoose.model('Route', RouteSchema);
