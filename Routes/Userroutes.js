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

// // Sign In
// router.post('/signin', async (req, res) => {
//     const { email, password } = req.body;
//     try {
//         const user = await User.findOne({ email });
//         if (!user) return res.status(400).json({ error: 'Invalid credentials' });
//         const isMatch = await bcrypt.compare(password, user.password);
//         if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

//         const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '999y' });
//         res.json({ token });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

module.exports = router;