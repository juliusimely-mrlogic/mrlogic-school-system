const jwt = require('jsonwebtoken');
const config = require('../config');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Hakuna token' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token si sahihi au imeisha muda' });
  }
};

module.exports = authenticate;