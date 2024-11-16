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

const handleConnection = (io) => (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('getConnectedTrucks', () => {
        if (socket.user.role !== 'logistics_head') {
            return socket.emit('message', 'Unauthorized access');
        }
        socket.emit('connectedTrucks', global.connectedTrucks);
    });

    socket.on('joinRoom', async (vehicleNumber) => {
        try {
            if (socket.user.role !== 'driver') {
                return socket.emit('message', 'Invalid role');
            }
    
            const roomName = `${vehicleNumber}-${socket.user.email}`;
            if (socket.rooms.has(roomName)) {
                return socket.emit('message', `You are already connected to vehicle: ${vehicleNumber}`);
            }
    
            const assignedTruck = await AssignedTrucks.findOne({ vehicleNumber, driverEmail: socket.user.email });
            if (!assignedTruck) {
                return socket.emit('message', 'You are not assigned to this vehicle. Access denied.');
            }
    
            const latestRoute = await Route.findOne({ vehicleNumber, status: { $ne: 'ended' } }).sort({ assignmentTime: -1 });
            if (latestRoute) {
                latestRoute.status = 'driving safely'; // Update status to "driving safely"
                await latestRoute.save();
                io.to(roomName).emit('statusUpdate', latestRoute.status); // Emit status update
            } else {
                socket.emit('message', 'No active route found for this vehicle.');
                return;
            }
    
            socket.join(roomName);
            console.log(`Driver ${socket.user.email} joined room: ${roomName}`);
            socket.emit('message', `Successfully joined the room for vehicle: ${vehicleNumber}`);
    
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('message', 'An error occurred while trying to join the room.');
        }
    });
    
    socket.on('sendMessage', async (vehicleNumber, message) => {
        try {
            const roomName = `${vehicleNumber}-${socket.user.email}`;
            
            if (!socket.rooms.has(roomName)) {
                return socket.emit('message', 'You are not allowed to send messages from this room.');
            }
    
            console.log(`Sending message to room: ${roomName}`);
    
            // Fetch the specific route using routeId, vehicleNumber, and ensure the route is not 'ended'
            const route = await Route.findOne({ vehicleNumber, status: { $ne: 'ended' } });
    
            if (!route) {
                return socket.emit('message', 'No active route found for this vehicle.');
            }
    
            // Add the message to the route's messages array
            route.messages.push({ message, timestamp: new Date() });
    
            // Check if the message starts with 'D' and the route status is 'Driving safely'
            if (message.startsWith('D') && route.status === 'Driving safely') {
                // Update the status to 'active alerts' only if it's not already in that state
                route.status = 'active alerts';
                await route.save(); // Save the updated route
                
                // Emit status update for this specific route
                io.to(roomName).emit('statusUpdate', route.status);
            }
    
            // Ensure the status remains 'active alerts' once it's set, preventing reversion
        if (route.status === 'active alerts') {
            io.to(roomName).emit('statusUpdate', route.status); // Emit current status
        }
    
            // Save the updated route after the message is added
            await route.save();
    
            // Emit the message to the correct room
            io.to(roomName).emit('message', message);
    
            // Notify logistics heads
            notifyLogisticsHeads(io, vehicleNumber, message);
    
        } catch (error) {
            console.error('Error handling sendMessage:', error);
            socket.emit('message', 'An error occurred while sending the message.');
        }
    });
    
    
    
    
    socket.on('getMessages', async (vehicleNumber) => {
        try {
            const route = await Route.findOne({ vehicleNumber }).sort({ assignmentTime: -1 });
            const messages = route?.messages || [];
            socket.emit('chatMessages', messages);
        } catch (error) {
            console.error('Error retrieving messages:', error);
            socket.emit('message', 'An error occurred while retrieving messages.');
        }
    });

    socket.on('endRoute', async (vehicleNumber) => {
        try {
            const roomName = `${vehicleNumber}-${socket.user.email}`;
            if (!socket.rooms.has(roomName)) {
                return socket.emit('message', 'You are not in the room for this vehicle.');
            }
    
            console.log(`Ending route for vehicle: ${vehicleNumber}`);
            socket.leave(roomName);
    
            const truckResult = await AssignedTrucks.deleteOne({ vehicleNumber });
            if (truckResult.deletedCount === 0) {
                console.log(`Vehicle ${vehicleNumber} was not found in the assigned list.`);
                return socket.emit('message', `Vehicle ${vehicleNumber} was not found in the assigned list.`);
            }
    
            const latestRoute = await Route.findOne({
                vehicleNumber,
                status: { $ne: 'ended' }
            }).sort({ assignmentTime: -1 });
    
            if (latestRoute) {
                latestRoute.status = 'ended';  // Update status to 'ended'
                await latestRoute.save();
                console.log(`Route for vehicle ${vehicleNumber} has been marked as ended.`);
                io.to(roomName).emit('message', `Route has ended for vehicle ${vehicleNumber}. The vehicle has left the room.`);
                io.to(roomName).emit('statusUpdate', latestRoute.status); // Emit final status update
            } else {
                console.log(`No active route found for vehicle ${vehicleNumber} that is not ended.`);
                return socket.emit('message', `No active route found for vehicle ${vehicleNumber} that is not ended.`);
            }
    
            global.connectedTrucks = global.connectedTrucks.filter(truck => truck !== vehicleNumber);
        } catch (error) {
            console.error('Error ending route:', error);
            socket.emit('message', 'An error occurred while ending the route.');
        }
    });
    
    
    socket.on('disconnect', () => {
        global.connectedTrucks.forEach(truckNumber => {
            if (socket.rooms.has(truckNumber)) {
                global.connectedTrucks = global.connectedTrucks.filter(truck => truck !== truckNumber);
            }
        });
        console.log(`Client disconnected: ${socket.id}`);
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