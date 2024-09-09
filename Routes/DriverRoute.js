const express = require('express');
const bcrypt = require('bcryptjs');
const Driver = require('../Models/Driver');
const sendEmail = require('../Utils/email');

const router = express.Router();

// Add Driver
router.post('/add', async (req, res) => {
    const { name, mobileNumber, email, companyId } = req.body;
    try {
        const password = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);
        const newDriver = new Driver({
            name,
            mobileNumber,
            email,
            password: hashedPassword,
            companyId,
        });
        await newDriver.save();
        await sendEmail(email, 'Your Napix Login Credentials', `Your password is: ${password}`);
        res.status(201).json({ message: 'Driver added' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
