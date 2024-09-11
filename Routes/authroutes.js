const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const Driver = require('../Models/Driver');
const { comparePassword } = require('../Utils/password');
const jwt = require('jsonwebtoken');

// Login
router.post('/login', async (req, res) => {
    console.log('Signin route hit');
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Attempt to find the user
        let user = await User.findOne({ email });
        if (!user) user = await Driver.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Compare the password
        const match = await comparePassword(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        // Generate a JWT token
        const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Respond with the token
        res.status(200).json({ token, role: user.role });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Change Password
router.post('/change-password', async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;

  try {
    let user = await Driver.findOne({ email });
    if (!user) user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await comparePassword(oldPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Old password is incorrect' });

    const hashedNewPassword = await hashPassword(newPassword);
    user.password = hashedNewPassword;
    user.passwordResetRequired = false;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
