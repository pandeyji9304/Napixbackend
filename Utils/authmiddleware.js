const jwt = require('jsonwebtoken');

const authenticateLogisticsHead = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (req.user.role !== 'logistics_head') return res.status(403).json({ error: 'Access denied' });
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authenticateLogisticsHead;
