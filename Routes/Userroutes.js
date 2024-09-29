const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Models/User');
const { hashPassword } = require('../Utils/password');
const router = express.Router();
const {authenticateLogisticsHead} = require('../Utils/authmiddleware');



// Sign Up
router.post('/signup/logistics-head', async (req, res) => {
    const { name, email, phoneNumber, password, companyName } = req.body;
    try {
        const hashedPassword = await hashPassword(password);
        const newUser = new User({
            name,
            email,
            phoneNumber,
            password: hashedPassword,
            role: 'logistics_head',
            companyName,
        });
        await newUser.save();
        res.status(201).json({ message: 'LogsticsUser created' });
    } catch (err) {
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
router.get('/profile',authenticateLogisticsHead, async (req, res) => {
    // console.log('User ID:', req.user._id); // Correct field: _id
    try {
        const user = await User.findById(req.user._id); // Use _id from the token
        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.status(200).json({
            id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            companyName: user.companyName
        });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ error: 'Server error' });
    }
});





module.exports = router;