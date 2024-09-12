const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const connectDB = require('./Config/db');
const userRoutes = require('./Routes/Userroutes');
const driverRoutes = require('./Routes/DriverRoute');
const vehicleRoutes = require('./Routes/VehicleRoute');
const routeRoutes = require('./Routes/routeRoute');
const authRoutes = require('./Routes/authroutes');
const Message = require('./Models/Messages');
const AssignedTrucks = require('./Models/AssignedTrucks');
const Route = require('./Models/Route');

require('dotenv').config();
const { JWT_SECRET } = process.env;

const app = express();
const server = http.createServer(app);

connectDB();

// Configure Socket.IO with CORS and authentication
const io = socketIo(server, {
    cors: {
        origin: 'http://127.0.0.1:5501',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    },
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    console.log('Received token:', token);

    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('JWT verification error:', err);
            return next(new Error('Authentication error'));
        }

        console.log('Decoded user data:', decoded);
        socket.user = decoded;
        next();
    });
});

// Configure CORS for Express
app.use(cors({
    origin: 'http://127.0.0.1:5501',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the Logistics Head page
app.get('/head', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'head.html'));
});

// Route to serve the Driver page
app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

app.get('/api/protected-route', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        res.json({ message: 'Protected data', user });
    });
});

app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/auth', authRoutes);

// Store connected trucks (rooms)
let connectedTrucks = [23454];

io.on('connection', (socket) => {
    console.log('New client connected');

    // Handler for logistics head to see connected trucks
    socket.on('getConnectedTrucks', async () => {
        if (socket.user.role !== 'logistics_head') {
            socket.emit('message', 'Unauthorized access');
            return;
        }
        // Fetch all assigned trucks
        const assignedTrucks = await AssignedTrucks.findOne();
        if (assignedTrucks) {
            socket.emit('connectedTrucks', assignedTrucks.assignedTrucks);
        } else {
            socket.emit('connectedTrucks', []);
        }
    });

    socket.on('joinRoom', async (vehicleNumber) => {
        try {
            if (socket.user.role === 'driver') {
                // Check if the vehicle number entered is valid and assigned to the driver
                const assignedTruck = await AssignedTrucks.findOne({ vehicleNumber });

                // If no assigned truck is found, deny access
                if (!assignedTruck) {
                    socket.emit('message', 'You are not assigned to this vehicle. Access denied.');
                    return;
                }

                // Join the room if the truck is assigned to the driver
                socket.join(vehicleNumber);
                connectedTrucks.push(vehicleNumber);
                socket.emit('message', `Successfully joined the room for vehicle: ${vehicleNumber}`);

            } else if (socket.user.role === 'logistics_head') {
                // Allow logistics head to join any room without restrictions
                socket.emit('message', 'Logistics head connected');
            } else {
                socket.emit('message', 'Invalid role');
            }
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('message', 'An error occurred while trying to join the room');
        }
    });

    // Handler for sending messages
    socket.on('sendMessage', async (vehicleNumber, message) => {
        if (socket.rooms.has(vehicleNumber)) {
            // Save the message to the database
            await Message.create({ truckNumber: vehicleNumber, message });

            // Broadcast the message to the room
            io.to(vehicleNumber).emit('message', message);
        } else {
            socket.emit('message', 'You are not allowed to send messages from this room.');
        }
    });

    // Handler for getting messages from a specific vehicle number
    socket.on('getMessages', async (vehicleNumber) => {
        const messages = await Message.find({ truckNumber: vehicleNumber }).sort({ timestamp: 1 });
        socket.emit('chatMessages', messages);
    });

    // Handler for ending a route
    socket.on('endRoute', async (vehicleNumber) => {
        try {
            if (!socket.rooms.has(vehicleNumber)) {
                socket.emit('message', 'You are not in the room for this vehicle.');
                return;
            }

            // Leave the room for the vehicle
            socket.leave(vehicleNumber);

            // Start a session for the transaction
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // Remove the truck from the AssignedTrucks list
                const truckResult = await AssignedTrucks.deleteOne({ vehicleNumber }).session(session);

                if (truckResult.deletedCount === 0) {
                    await session.abortTransaction();
                    session.endSession();
                    socket.emit('message', `Vehicle ${vehicleNumber} was not found in the assigned list.`);
                    return;
                }

                // Remove associated routes from the Routes collection
                const routeResult = await Route.deleteMany({ vehicleNumber }).session(session);

                if (routeResult.deletedCount === 0) {
                    console.log(`No routes found for vehicle ${vehicleNumber}.`);
                }

                // Commit the transaction
                await session.commitTransaction();
                session.endSession();

                // Notify the room
                io.to(vehicleNumber).emit('message', `Route has ended. The room has been closed, vehicle ${vehicleNumber} has been removed from the assigned list, and associated routes have been deleted.`);
                console.log(`Route for vehicle ${vehicleNumber} ended, and it was removed from the assigned list with associated routes deleted.`);
            } catch (error) {
                await session.abortTransaction();
                session.endSession();
                throw error;
            }
        } catch (error) {
            console.error('Error ending route:', error);
            socket.emit('message', 'An error occurred while ending the route.');
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
