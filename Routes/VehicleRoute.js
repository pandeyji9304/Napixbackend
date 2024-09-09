const express = require('express');
const Vehicle = require('../Models/Vehicle');

const router = express.Router();

// Add Vehicle
router.post('/add', async (req, res) => {
    const { vehicleNumber, companyId } = req.body;
    try {
        const newVehicle = new Vehicle({ vehicleNumber, companyId });
        await newVehicle.save();
        res.status(201).json({ message: 'Vehicle added' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
