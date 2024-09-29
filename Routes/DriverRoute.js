const express = require('express');
const bcrypt = require('bcryptjs');
const Driver = require('../Models/Driver');
const mongoose = require('mongoose');
const sendEmail = require('../Utils/email');
const upload = require('../Config/uploadConfig')

const router = express.Router();
const { generatePassword, hashPassword } = require('../Utils/password');
const {authenticateLogisticsHead} = require('../Utils/authmiddleware');
const { authenticateDriver } = require('../Utils/authmiddleware');

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



router.delete('/delete-driver/:email', authenticateLogisticsHead, async (req, res) => {
    const { email } = req.params;

    try {
        // Find the driver by email and delete
        const deletedDriver = await Driver.findOneAndDelete({ email });

        if (!deletedDriver) {
            return res.status(404).json({ message: 'Driver not found' });
        }

        // Optionally, you can log the action or notify an admin here

        // Respond to the client
        res.status(200).json({ message: 'Driver deleted successfully' });

    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(500).json({ error: 'Failed to delete driver' });
    }
});

router.put('/update-profile', authenticateDriver, upload.single('image'), async (req, res) => {
    const { name, mobileNumber, email } = req.body;  // email of the driver to update

    try {
        // Ensure the email is provided
        if (!email) {
            return res.status(400).json({ error: 'Email is required to update profile' });
        }

        // Find the driver by their email address
        const driver = await Driver.findOne({ email });

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found with this email' });
        }

        // Update the profile details
        if (name) driver.name = name;
        if (mobileNumber) driver.mobileNumber = mobileNumber;

        // Check if an image was uploaded and update the image field
        if (req.file) {
            driver.image = `/uploads/drivers/${req.file.filename}`; // Update the image path with the uploaded file
        }

        // Save the updated driver
        await driver.save();

        res.status(200).json({ message: 'Profile updated successfully for the driver with email: ' + email });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


router.get('/driverdetail', authenticateDriver, async (req, res) => {
    const { email } = req.query; // For logistics head to access other driver details

    try {
        if (req.role === 'driver') {
            // If logged-in user is a driver, return their own details
            const driver = req.driver;
            return res.status(200).json({
                name: driver.name,
                mobileNumber: driver.mobileNumber,
                email: driver.email,
                
            });
        }

        if (req.role === 'logistics_head') {
            // If logged-in user is a logistics head, allow them to access any driver's details
            if (!email) {
                return res.status(400).json({ error: 'Email query parameter is required' });
            }

            // Find the driver by email
            const driver = await Driver.findOne({ email });

            if (!driver) {
                return res.status(404).json({ error: 'Driver not found' });
            }

            return res.status(200).json({
                name: driver.name,
                mobileNumber: driver.mobileNumber,
                email: driver.email,
            });
        }

        // If user role is neither driver nor logistics head
        res.status(403).json({ error: 'Access denied' });
    } catch (err) {
        console.error('Error fetching driver details:', err);
        res.status(500).json({ error: 'Server error' });
    }
});





// Route to get all drivers
router.get('/getdrivers', authenticateLogisticsHead, async (req, res) => {
    try {
        if (req.user.role !== 'logistics_head') {
            return res.status(403).json({ error: 'Access denied: Only logistics heads can view vehicles.' });
        }

        // Find drivers assigned to the authenticated logistics head
        const drivers = await Driver.find({ assignedBy: req.user._id });

        // Respond with the found drivers
        res.status(200).json(drivers);
    } catch (err) {
        console.error('Error fetching drivers:', err);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
