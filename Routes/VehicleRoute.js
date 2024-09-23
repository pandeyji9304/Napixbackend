const express = require('express');
const Vehicle = require('../Models/Vehicle');
const Message = require('../Models/Messages');
const {authenticateLogisticsHead} = require('../Utils/authmiddleware');
const router = express.Router();

// Add Vehicle
router.post('/add', authenticateLogisticsHead, async (req, res) => {
    console.log('Vehicle route hit');
    const { vehicleNumber } = req.body;
    try {
        const newVehicle = new Vehicle({ vehicleNumber, assignedBy: req.user._id });
        await newVehicle.save();
        res.status(201).json({ message: 'Vehicle added' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Route to get all vehicles
router.get('/getvehicles',authenticateLogisticsHead, async (req, res) => {
    console.log("get vehicleroute hit")
    try {
        const vehicles = await Vehicle.find();
        res.status(200).json(vehicles);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


router.get('/messages/:vehicleNumber', async (req, res) => {
    const { vehicleNumber } = req.params;
    try {
        const messageDoc = await Message.find({ truckNumber: vehicleNumber });
            res.status(200).json(messageDoc);
        
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(400).json({error: err.message  });
    }
});

module.exports = router;
