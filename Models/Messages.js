const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    truckNumber: { type: String, required: true },
    messages: [{
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Message', messageSchema);
