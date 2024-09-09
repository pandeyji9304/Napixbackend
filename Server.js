const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path'); // Import the path module
const connectDB = require('./Config/db');
const userRoutes = require('./Routes/Userroutes');
const driverRoutes = require('./Routes/DriverRoute');
const vehicleRoutes = require('./Routes/VehicleRoute');
const routeRoutes = require('./Routes/routeRoute');
require('dotenv').config();


const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
    cors: {
        origin: 'http://127.0.0.1:5501', // Ensure this matches the client origin exactly
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
    }
});

connectDB();

// Configure CORS for Express
app.use(cors({
    origin: 'http://127.0.0.1:5501', // Ensure this matches the client origin exactly
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
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

// Simple GET route
app.get('/api/health', (req, res) => {
    res.status(200).json({ message: 'API is working' });
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/routes', routeRoutes);


// Store messages for each truck in memory (for demo purposes)
let truckMessages = {};

io.on('connection', (socket) => {
    console.log('New client connected');

    // Driver connects with a truck number (passcode)
    socket.on('driverConnect', (truckNumber) => {
        socket.join(truckNumber); // Driver joins the room for their truck
        console.log(`Driver connected to truck ${truckNumber}`);

        // Inform logistics head about the truck connection
        io.emit('truckConnected', { truckNumber });

        // Initialize message storage for this truck
        if (!truckMessages[truckNumber]) {
            truckMessages[truckNumber] = [];
        }
    });

    // Driver sends data to the room
    socket.on('sendData', (data) => {
        const { truckNumber, message } = data;
        console.log(`Data from truck ${truckNumber}: ${message}`);

        // Store the message for this truck
        if (truckMessages[truckNumber]) {
            truckMessages[truckNumber].push(message);
        }

        // Send the message to all clients in the truck room
        io.to(truckNumber).emit('driverData', { truckNumber, message });
    });

    // Handle logistics head's request for messages of a particular truck
    socket.on('getTruckMessages', (truckNumber) => {
        if (truckMessages[truckNumber]) {
            // Send all stored messages of this truck to logistics head
            socket.emit('truckMessages', { truckNumber, messages: truckMessages[truckNumber] });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});
// Server listening
const PORT = process.env.PORT;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
