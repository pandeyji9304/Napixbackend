const express = require('express');
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
require('dotenv').config();
const { JWT_SECRET } = process.env;

const app = express();
const server = http.createServer(app);

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

connectDB();

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

    // Handler for joining a room based on vehicle number
    socket.on('joinRoom', async (vehicleNumber) => {
        if (socket.user.role === 'driver') {
            const assignedTrucks = await AssignedTrucks.findOne();
            if (!assignedTrucks || !assignedTrucks.assignedTrucks.includes(vehicleNumber)) {
                socket.emit('message', 'This truck is not assigned. Access denied.');
                return;
            }
            socket.join(vehicleNumber);
            socket.emit('message', `Joined room: ${vehicleNumber}`);
        } else if (socket.user.role === 'logistics_head') {
            socket.emit('message', 'Logistics head connected');
        } else {
            socket.emit('message', 'Invalid role');
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
        socket.leave(vehicleNumber);
        
        // Delete all messages for this truck from the database
        await Message.deleteMany({ truckNumber: vehicleNumber });
        
        // Notify the room
        io.to(vehicleNumber).emit('message', `Route has ended. The room has been closed.`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
