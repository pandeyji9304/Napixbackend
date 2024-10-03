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
            // Check if the user is a driver
            if (socket.user.role !== 'driver') {
                return socket.emit('message', 'Invalid role');
            }
    
            const roomName = `${vehicleNumber}-${socket.user.email}`;
            if (socket.rooms.has(roomName)) {
                return socket.emit('message', `You are already connected to vehicle: ${vehicleNumber}`);
            }
    
            // Check if the truck is assigned to this driver
            const assignedTruck = await AssignedTrucks.findOne({ vehicleNumber, driverEmail: socket.user.email });
            if (!assignedTruck) {
                return socket.emit('message', 'You are not assigned to this vehicle. Access denied.');
            }
    
            // Get the latest route that is not ended
            const latestRoute = await Route.findOne({ vehicleNumber, status: { $ne: 'ended' } }).sort({ assignmentTime: -1 });
            if (latestRoute) {
                // Update the latest route's status if it's not ended
                latestRoute.status = 'driving safely'; // Update status to "driving safely"
                await latestRoute.save(); // Save the updated route
            } else {
                socket.emit('message', 'No active route found for this vehicle.');
                return;
            }
    
            // Join the room for this vehicle and driver
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
    
            // Fetch the latest route for this vehicle where status is not 'ended'
            const latestRoute = await Route.findOne({ vehicleNumber, status: { $ne: 'ended' } }).sort({ assignmentTime: -1 });
    
            // If no active route is found, return an error
            if (!latestRoute) {
                return socket.emit('message', 'No active route found for this vehicle.');
            }
    
            // Push the message to the messages array of the latest route
            latestRoute.messages.push({ message, timestamp: new Date() });
    
            // Update the status of the latest route based on the message content
            if (message.startsWith('D')) {
                latestRoute.status = 'active alerts'; // Change status to "active alerts" if the message starts with "D"
            } else {
                latestRoute.status = 'driving safely'; // Otherwise, set status to "Active alertd"
            }
    
            await latestRoute.save();
    
            // Broadcast the message to the room
            io.to(roomName).emit('message', message);
    
            // Notify logistics heads about the new message
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
    
            // Find the latest active route for the vehicle that is not ended
            const latestRoute = await Route.findOne({
                vehicleNumber,
                status: { $ne: 'ended' }  // Only select routes that are not ended
            }).sort({ assignmentTime: -1 });
    
            // Check if the latest route is found
            if (latestRoute) {
                latestRoute.status = 'ended';  // Update status to 'ended'
                await latestRoute.save();
                console.log(`Route for vehicle ${vehicleNumber} has been marked as ended.`);
                io.to(roomName).emit('message', `Route has ended for vehicle ${vehicleNumber}. The vehicle has left the room.`);
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