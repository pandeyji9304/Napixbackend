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
    console.log("create route hit");

    const { vehicleNumber, driverName, fromLocation, toLocation, departureDetails, initialMessage } = req.body;

    try {
        // Ensure that the driver exists
        const driver = await Driver.findOne({ name: driverName });
        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        // Only logistics heads can create routes
        if (req.user.role !== 'logistics_head') {
            return res.status(403).json({ message: 'Only logistics heads can assign trucks' });
        }

        // Create the route object, with the possibility of an initial message
        const newRoute = new Route({
            vehicleNumber,
            driverName,
            fromLocation,
            toLocation,
            departureDetails,
            messages: initialMessage ? [{ message: initialMessage }] : [] // Add initial message if provided
        });

        await newRoute.save();

        // Check if the truck is already assigned
        let assignedTruck = await AssignedTrucks.findOne({ vehicleNumber });
        if (!assignedTruck) {
            assignedTruck = new AssignedTrucks({
                vehicleNumber,
            });
            await assignedTruck.save();
        }

        // Notify the room associated with the vehicle number
        io.to(vehicleNumber).emit('routeCreated', {
            vehicleNumber,
            driverName,
            fromLocation,
            toLocation,
            departureDetails,
            initialMessage: initialMessage || ''
        });

        res.status(201).json({ message: 'Route added, truck assigned, and initial message stored', routeId: newRoute._id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/routes/:id/messages', async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).send({ message: 'Route not found' });
        }

        // Send only the messages
        res.send({ messages: route.messages });
    } catch (error) {
        res.status(500).send({ message: 'Server error', error });
    }
});

router.put('/edit-route/:id', async (req, res) => {
    console.log("edit route hit");

    const { vehicleNumber, driverName, fromLocation, toLocation, departureDetails, updatedMessage } = req.body;
    const routeId = req.params.id;

    try {
        // Ensure that the driver exists
        const driver = await Driver.findOne({ name: driverName });
        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        // Only logistics heads can edit routes
        if (req.user.role !== 'logistics_head') {
            return res.status(403).json({ message: 'Only logistics heads can edit routes' });
        }

        // Find the existing route by ID
        const existingRoute = await Route.findById(routeId);
        if (!existingRoute) {
            return res.status(404).json({ error: 'Route not found' });
        }

        // Update the route details
        existingRoute.vehicleNumber = vehicleNumber || existingRoute.vehicleNumber;
        existingRoute.driverName = driverName || existingRoute.driverName;
        existingRoute.fromLocation = fromLocation || existingRoute.fromLocation;
        existingRoute.toLocation = toLocation || existingRoute.toLocation;
        existingRoute.departureDetails = departureDetails || existingRoute.departureDetails;

        // Update messages if provided
        if (updatedMessage) {
            existingRoute.messages.push({ message: updatedMessage });
        }

        // Save the updated route
        await existingRoute.save();

        // Notify the room associated with the vehicle number
        io.to(vehicleNumber).emit('routeUpdated', {
            routeId,
            vehicleNumber,
            driverName,
            fromLocation,
            toLocation,
            departureDetails,
            updatedMessage: updatedMessage || ''
        });

        res.status(200).json({ message: 'Route updated successfully', routeId: existingRoute._id });
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

router.get('/routes/:vehicleNumber', async (req, res) => {
    const { vehicleNumber } = req.params;
    
    try {
        // Find all routes associated with the given vehicleNumber
        const routes = await Route.find({ vehicleNumber });

        if (routes && routes.length > 0) {
            // Return the route details
            res.status(200).json(routes);
        } else {
            // If no routes found, return a suitable message
            res.json(routes);
        }
    } catch (error) {
        console.error('Error retrieving routes:', error);
        res.status(400).json({ error: error.message });
    }
});




module.exports = router;
