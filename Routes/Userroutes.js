const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../Models/User');
const { hashPassword } = require('../Utils/password');
const router = express.Router();
const upload = require('../Config/uploadConfig')
const {authenticateLogisticsHead} = require('../Utils/authmiddleware');


router.post('/signup/logistics-head', upload.single('profileImage'), [
    body('email').isEmail().withMessage('Invalid email address'), // Validate email
    body('phoneNumber').isNumeric().withMessage('Phone number must be numeric'), // Validate phone number
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long') // Validate password length
], async (req, res) => {

    const { name, email, phoneNumber, password, companyName } = req.body;

    try {
        // Ensure all required fields are present
        if (!name || !email || !phoneNumber || !password || !companyName) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // Check if the email already exists in the database
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User with this email already exists." });
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);

        // Create a new user
        const newUser = new User({
            name,
            email,
            phoneNumber,
            password: hashedPassword,
            role: 'logistics_head',
            companyName,
            profileImage: req.file ? req.file.path : null
        });

        // Save the user to the database
        await newUser.save();

        // Generate a JWT token
        const token = jwt.sign({ userId: newUser._id, role: newUser.role }, process.env.JWT_SECRET, {
        });

        // Respond with the token and role
        res.status(201).json({
            message: 'LogisticsUser created',
            token: token,
            role: newUser.role
        });
    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(400).json({ error: err.message });
    }
});


router.put('/edit-user/:id', authenticateLogisticsHead, async (req, res) => {
    const { id } = req.params;
    const { name, email, phoneNumber, companyName } = req.body;

    try {
        // Find the user by ID and update their details
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { name, email, phoneNumber, companyName },
            { new: true, runValidators: true } // Return the updated document and run validation
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Respond to the client with the updated user details
        res.status(200).json({ message: 'User details updated successfully', user: updatedUser });

    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(400).json({ error: err.message });
    }
});


// Route to get user details after signup
// Route to get user details
router.get('/profile', authenticateLogisticsHead, async (req, res) => {
    if (!req.user || !req.user._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized access' });
    }

    console.log('User ID:', req.user._id);

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            console.log(`No user found for ID: ${req.user._id} from request made by ${req.ip}`);
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        // Remove sensitive information
        const { password, ...userDetails } = user.toObject();

        console.log('User data fetched:', userDetails);

        res.status(200).json({
            success: true,
            id: userDetails._id,
            image: userDetails.profileImage, 
            name: userDetails.name,
            email: userDetails.email,
            phoneNumber: userDetails.phoneNumber,
            companyName: userDetails.companyName,
        });
    } catch (err) {
        console.error('Error fetching user with ID:', req.user._id, 'Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});







module.exports = router;