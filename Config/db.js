// const mongoose = require('mongoose');

// const connectDB = async () => {
//     try {
//         await mongoose.connect('mongodb://localhost:27017/napix', {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         });
//         console.log('MongoDB connected');
//     } catch (err) {
//         console.error(err.message);
//         process.exit(1);
//     }
// };

// module.exports = connectDB;


// Load environment variables from .env file
// ./Config/db.js
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

const connectDB = () => {
    mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
};

module.exports = connectDB;

//https://napixbackend-2.onrender.com/api/users/signup


