const jwt = require('jsonwebtoken');
const Message = require('../Models/Messages');
const AssignedTrucks = require('../Models/AssignedTrucks');
const Route = require('../Models/Route');
const { JWT_SECRET } = process.env;

const authenticate = (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded;
        next();
    });
};

const handleConnection = (io) => (socket) => {
    console.log('New client connected');

    socket.on('getConnectedTrucks', () => {
        if (socket.user.role !== 'logistics_head') {
            socket.emit('message', 'Unauthorized access');
            return;
        }
        // Send the list of currently connected trucks
        socket.emit('connectedTrucks', global.connectedTrucks);
    });

    socket.on('joinRoom', async (vehicleNumber) => {
        try {
            if (socket.user.role === 'driver') {
                const assignedTruck = await AssignedTrucks.findOne({ vehicleNumber });
                if (!assignedTruck) {
                    socket.emit('message', 'You are not assigned to this vehicle. Access denied.');
                    return;
                }
                socket.join(vehicleNumber);

                await Route.updateOne({ vehicleNumber }, { status: 'driving safely' });

                global.connectedTrucks.push(vehicleNumber);
                socket.emit('message', `Successfully joined the room for vehicle: ${vehicleNumber}`);
            } else if (socket.user.role === 'logistics_head') {
                socket.emit('message', 'Logistics head connected');
            } else {
                socket.emit('message', 'Invalid role');
            }
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('message', 'An error occurred while trying to join the room');
        }
    });

    socket.on('sendMessage', async (vehicleNumber, message) => {
        if (socket.rooms.has(vehicleNumber)) {
            await Message.create({ truckNumber: vehicleNumber, message });

            // Update route status to "active alerts"
        await Route.findOneAndUpdate(
            { vehicleNumber },
            { status: 'active alerts' },
            { new: true }
        );
            io.to(vehicleNumber).emit('message', message);
        } else {
            socket.emit('message', 'You are not allowed to send messages from this room.');
        }
    });

    socket.on('getMessages', async (vehicleNumber) => {
        const messages = await Message.find({ truckNumber: vehicleNumber }).sort({ timestamp: 1 });
        socket.emit('chatMessages', messages);
    });

    socket.on('endRoute', async (vehicleNumber) => {
        try {
            if (!socket.rooms.has(vehicleNumber)) {
                socket.emit('message', 'You are not in the room for this vehicle.');
                return;
            }

            socket.leave(vehicleNumber);
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                const truckResult = await AssignedTrucks.deleteOne({ vehicleNumber }).session(session);
                if (truckResult.deletedCount === 0) {
                    await session.abortTransaction();
                    session.endSession();
                    socket.emit('message', `Vehicle ${vehicleNumber} was not found in the assigned list.`);
                    return;
                }

                const routeResult = await Route.deleteMany({ vehicleNumber }).session(session);
                if (routeResult.deletedCount === 0) {
                    console.log(`No routes found for vehicle ${vehicleNumber}.`);
                }
            

                await session.commitTransaction();
                session.endSession();

                // Remove vehicleNumber from connectedTrucks
                global.connectedTrucks = global.connectedTrucks.filter(truck => truck !== vehicleNumber);

                io.to(vehicleNumber).emit('message', `Route has ended. The room has been closed, vehicle ${vehicleNumber} has been removed from the assigned list, and associated routes have been deleted.`);
            } catch (error) {
                await session.abortTransaction();
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
};

module.exports = { authenticate, handleConnection };
