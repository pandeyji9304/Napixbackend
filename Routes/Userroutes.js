const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../Models/User');
const { hashPassword } = require('../Utils/password');
const router = express.Router();

// Sign Up
router.post('/signup/logistics-head', async (req, res) => {
    console.log('Signup route hit');
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

module.exports = router;