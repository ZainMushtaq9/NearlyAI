const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const getDb = require('../utils/db');

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
        const userRole = (role === 'owner' || role === 'admin') ? role : 'customer';

        const db = await getDb();
        const exists = await db.get('SELECT id FROM users WHERE email = ?', email);
        if (exists) return res.status(409).json({ error: 'Email already registered' });

        const hash = await bcrypt.hash(password, 10);
        const result = await db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', name, email, hash, userRole);

        const token = jwt.sign({ id: result.lastID, email, role: userRole, name }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: result.lastID, name, email, role: userRole } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const db = await getDb();
        const user = await db.get('SELECT * FROM users WHERE email = ?', email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const db = await getDb();
        const user = await db.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
