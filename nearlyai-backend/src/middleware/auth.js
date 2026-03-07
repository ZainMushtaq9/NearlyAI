const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    try { req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET); next(); }
    catch { return res.status(401).json({ error: 'Invalid token' }); }
}

function adminGuard(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
}

function ownerGuard(req, res, next) {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') return res.status(403).json({ error: 'Owner access required' });
    next();
}

module.exports = { authMiddleware, adminGuard, ownerGuard };
