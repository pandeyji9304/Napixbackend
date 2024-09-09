const express = require('express');
const Route = require('../Models/Route');
const router = express.Router();
const io = require('socket.io')(require('http').createServer());

// Add Route
router.post('/add', async (req, res) => {
    const { vehicleNumber, driverId, fromLocation, toLocation, departureDetails } = req.body;
    try {
        const passKey = vehicleNumber; // Use vehicleNumber as the pass key
        const newRoute = new Route({
            vehicleNumber,
            driverId,
            fromLocation,
            toLocation,
            departureDetails,
            passKey, // Store the pass key
        });
        await newRoute.save();

        // Notify all connected logistics heads about the new route
        Object.values(io.sockets.sockets).forEach(socket => {
            if (socket.id in logisticsHeads) {
                socket.emit('logisticsHeadUpdate', { truckNumber: vehicleNumber });
            }
        });

        res.status(201).json({ message: 'Route added', routeId: newRoute._id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
