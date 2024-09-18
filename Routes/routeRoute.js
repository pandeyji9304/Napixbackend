const express = require('express');
const Route = require('../Models/Route');
const AssignedTrucks = require('../Models/AssignedTrucks')
const router = express.Router();
const io = require('socket.io')(require('http').createServer());
const Driver = require('../Models/Driver');
const {authenticateLogisticsHead} = require('../Utils/authmiddleware');
const mongoose = require('mongoose');

// Middleware to check if the user is a logistics head
router.use(authenticateLogisticsHead);

router.post('/create-route', async (req, res) => {
    console.log("createroute hited")
    const { vehicleNumber, driverName, fromLocation, toLocation, departureDetails } = req.body;

    try {
        // Ensure that the driver exists
        const driver = await Driver.findOne({ name: driverName });
        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        // Only logistics heads can create routes
        if (req.user.role !== 'logistics_head') {
            return res.status(403).json({ message: 'Only logistics heads can assign trucks' });
        }

        // Create a new route
        const newRoute = new Route({
            vehicleNumber,
            driverName,
            fromLocation,
            toLocation,
            departureDetails,
        });

        await newRoute.save();

        // Check if the truck is already assigned
        let assignedTruck = await AssignedTrucks.findOne({ vehicleNumber });
        if (!assignedTruck) {
            assignedTruck = new AssignedTrucks({ vehicleNumber });
            await assignedTruck.save();
        }

        // Notify the room associated with the vehicle number
        io.to(vehicleNumber).emit('routeCreated', {
            vehicleNumber,
            driverName,
            fromLocation,
            toLocation,
            departureDetails
        });

        res.status(201).json({ message: 'Route added and truck assigned', routeId: newRoute._id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


router.get('/getroutes', async (req, res) => {
    try {
        // Retrieve all route details
        const routes = await Route.find();

        // Retrieve all assigned trucks
        const assignedTrucks = await AssignedTrucks.find();

        // Create a map of vehicle numbers to assigned trucks for quick lookup
        const assignedTrucksMap = assignedTrucks.reduce((map, truck) => {
            map[truck.vehicleNumber] = truck;
            return map;
        }, {});

        // Map routes to include the assigned truck details
        const routesWithTrucks = routes.map(route => ({
            ...route.toObject(),
            assignedTruck: assignedTrucksMap[route.vehicleNumber] || null
        }));

        res.status(200).json({ routes: routesWithTrucks });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});




router.post('/validate-truck', async (req, res) => {
    const { vehicleNumber } = req.body;

    try {
        // Fetch the assigned trucks list
        const assignedTrucks = await AssignedTrucks.findOne();

        // Check if the vehicle number exists in the assigned trucks array
        if (!assignedTrucks || !assignedTrucks.assignedTrucks.includes(vehicleNumber)) {
            return res.status(400).json({ error: 'This truck is not assigned by a logistics head' });
        }

        res.status(200).json({ message: 'Truck is valid and assigned' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});




module.exports = router;
