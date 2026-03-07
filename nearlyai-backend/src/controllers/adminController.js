const getDb = require('../utils/db');

exports.getStats = async (req, res) => {
    try {
        const db = await getDb();
        res.json({
            userCount: (await db.get('SELECT COUNT(*) as c FROM users')).c,
            businessCount: (await db.get('SELECT COUNT(*) as c FROM businesses')).c,
            pendingCount: (await db.get('SELECT COUNT(*) as c FROM businesses WHERE verified = 0')).c,
            reviewCount: (await db.get('SELECT COUNT(*) as c FROM reviews')).c,
            flaggedReviews: (await db.get('SELECT COUNT(*) as c FROM reviews WHERE flagged = 1')).c
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPending = async (req, res) => {
    try {
        const db = await getDb();
        res.json(await db.all('SELECT b.*, u.name as owner_name FROM businesses b JOIN users u ON b.owner_id = u.id WHERE b.verified = 0'));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.verify = async (req, res) => {
    try {
        const db = await getDb();
        await db.run('UPDATE businesses SET verified = 1 WHERE id = ?', req.params.id);
        res.json({ message: 'Business verified' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.suspend = async (req, res) => {
    try {
        const db = await getDb();
        await db.run('UPDATE businesses SET suspended = 1 WHERE id = ?', req.params.id);
        res.json({ message: 'Business suspended' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFlaggedReviews = async (req, res) => {
    try {
        const db = await getDb();
        res.json(await db.all('SELECT r.*, u.name as reviewer_name, b.name as business_name FROM reviews r JOIN users u ON r.customer_id = u.id JOIN businesses b ON r.business_id = b.id WHERE r.flagged = 1'));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let sql = 'SELECT id, name, email, role, created_at FROM users';
        const params = [];
        if (search) { sql += ' WHERE name LIKE ? OR email LIKE ?'; params.push(`%${search}%`, `%${search}%`); }
        sql += ' ORDER BY created_at DESC';
        const db = await getDb();
        res.json(await db.all(sql, ...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteUser = async (req, res) => {
    try {
        const db = await getDb();
        await db.run("DELETE FROM users WHERE id = ? AND role != 'admin'", req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
