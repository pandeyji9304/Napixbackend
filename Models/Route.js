const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
    vehicleNumber: { type: String, required: true },
    driverName: { type: String, required: true },
    fromLocation: { type: String, required: true },
    toLocation: { type: String, required: true },
    departureDetails: {
        departureTime: {
            type: Date,
            required: true,
        },
    },
    status: {
        type: String,
        default: 'scheduled', // Default status when the route is created
        enum: ['scheduled', 'driving safely', 'active alerts', 'completed'], // Enum for possible statuses
    },
});

module.exports = mongoose.model('Route', RouteSchema);
