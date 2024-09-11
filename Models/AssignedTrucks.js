const mongoose = require('mongoose');
// Schema for keeping track of all assigned trucks
const AssignedTrucksSchema = new mongoose.Schema({
    vehicleNumber: { type: String, required: true }, // This will hold an array of all assigned truck numbers
});

module.exports = mongoose.model('AssignedTrucks', AssignedTrucksSchema);