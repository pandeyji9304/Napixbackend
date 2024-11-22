const jwt = require('jsonwebtoken');
const AssignedTrucks = require('../Models/AssignedTrucks');
const Route = require('../Models/Route');
const { JWT_SECRET } = process.env;
const mongoose = require("mongoose");

// Helper function to check if a truck is already connected
const isTruckConnected = (vehicleNumber) => global.connectedTrucks.includes(vehicleNumber);

const authenticate = (socket, next) => {
    const token = socket.handshake.headers['authorization']?.replace('Bearer ', '');
    console.log('Received token:', token);
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded;
        next();
    });
};


// socketmiddleware.js
const handleConnection = (io) => (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('joinRoom', async (vehicleNumber) => {
        try {
            if (socket.user.role !== 'driver') {
                return socket.emit('message', 'Invalid role');
            }

            // Use vehicleNumber as room key
            const roomName = vehicleNumber;

            // Check if driver is assigned to this vehicle
            const assignedTruck = await AssignedTrucks.findOne({ 
                vehicleNumber, 
                driverEmail: socket.user.email 
            });

            if (!assignedTruck) {
                return socket.emit('message', 'You are not assigned to this vehicle');
            }

            // Find active route
            const route = await Route.findOne({ 
                vehicleNumber, 
                status: { $ne: 'ended' } 
            }).sort({ createdAt: -1 });

            if (!route) {
                return socket.emit('message', 'No active route found');
            }

            // Join room and update status
            socket.join(roomName);
            route.status = 'driving safely';
            await route.save();

            // Notify room of status change
            io.to(roomName).emit('statusUpdate', {
                routeId: route._id,
                status: route.status
            });

            socket.emit('message', 'Successfully joined');
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('message', 'Failed to join room');
        }
    });

    socket.on('sendMessage', async (vehicleNumber, message) => {
        try {
            const route = await Route.findOne({ 
                vehicleNumber, 
                status: { $ne: 'ended' } 
            });

            if (!route) {
                return socket.emit('message', 'No active route found');
            }

            // Add message to route
            route.messages.push({
                message,
                timestamp: new Date(),
                isRead: false
            });

            // Update status based on message content
            if (message.includes('Drowsiness detected at')) {
                route.status = 'active alerts';
            } else if (message.includes('Monitoring Stopped at')) {
                route.status = 'ended';
                // Leave room when monitoring stops
                socket.leave(vehicleNumber);
            }

            await route.save();

            // Broadcast message and status update to room
            io.to(vehicleNumber).emit('newMessage', {
                routeId: route._id,
                message,
                timestamp: new Date()
            });

            io.to(vehicleNumber).emit('statusUpdate', {
                routeId: route._id,
                status: route.status
            });
        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('message', 'Failed to send message');
        }
    });

    socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id);
    });
};

const notifyLogisticsHeads = (io, vehicleNumber, message) => {
    io.sockets.sockets.forEach(client => {
        if (client.user && client.user.role === 'logistics_head') {
            client.emit('message', `New message for truck ${vehicleNumber}: ${message}`);
        }
    });
};

module.exports = { authenticate, handleConnection };
//original