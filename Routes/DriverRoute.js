const express = require('express');
const bcrypt = require('bcryptjs');
const Driver = require('../Models/Driver');
const mongoose = require('mongoose');
const sendEmail = require('../Utils/email');

const router = express.Router();
const { generatePassword, hashPassword } = require('../Utils/password');
const authenticateLogisticsHead = require('../Utils/authmiddleware');

// Add Driver
router.post('/add-driver', authenticateLogisticsHead, async (req, res) => {
    const { name, mobileNumber, email } = req.body;

    try {
        // Generate a password and hash it
        const password = generatePassword();
        const hashedPassword = await hashPassword(password);

        // Create a new driver
        const newDriver = new Driver({
            name,
            mobileNumber,
            email,
            password: hashedPassword,
            assignedBy: req.user._id
        });

        // Save the driver to the database
        await newDriver.save();

        // Attempt to send an email with the credentials
        try {
            await sendEmail(email, 'Your Napix Login Credentials', `Your password is: ${password}`);
            console.log('Email sent successfully');
        } catch (emailError) {
            console.error('Failed to send email:', emailError.message);
            // Optionally, you can log the error or notify an admin but ensure the driver creation is not affected
        }

        // Respond to the client
        res.status(201).json({ message: 'Driver added' });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Route to get all drivers
router.get('/getdrivers', async (req, res) => {
    try {
        const drivers = await Driver.find();
        res.status(200).json(drivers);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


module.exports = router;
