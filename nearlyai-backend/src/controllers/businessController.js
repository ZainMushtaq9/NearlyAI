const getDb = require('../utils/db');

exports.getAll = async (req, res) => {
    try {
        const { city, category, verified, rating, search, area } = req.query;
        let sql = 'SELECT b.*, c.name as category_name, c.icon as category_icon FROM businesses b LEFT JOIN categories c ON b.category_id = c.id WHERE b.suspended = 0';
        const params = [];
        if (city) { sql += ' AND b.city = ?'; params.push(city); }
        if (area) { sql += ' AND b.area LIKE ?'; params.push(`%${area}%`); }
        if (category) { sql += ' AND b.category_id = ?'; params.push(category); }
        if (verified) { sql += ' AND b.verified = 1'; }
        if (rating) { sql += ' AND b.avg_rating >= ?'; params.push(parseFloat(rating)); }
        if (search) { sql += ' AND (b.name LIKE ? OR b.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        sql += ' ORDER BY b.verified DESC, b.avg_rating DESC';

        const db = await getDb();
        res.json(await db.all(sql, ...params));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getNearby = async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
        const r = parseFloat(radius) || 5;
        const db = await getDb();

        const businesses = await db.all(`
      SELECT b.*, c.name as category_name, c.icon as category_icon, 
      (6371 * acos(cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat)))) AS distance
      FROM businesses b LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.suspended = 0 AND b.lat IS NOT NULL AND b.lng IS NOT NULL
      ORDER BY distance ASC
    `, parseFloat(lat), parseFloat(lng), parseFloat(lat));

        // SQLite doesn't support HAVING alias completely in all forms, so we filter in JS
        const filtered = businesses.filter(b => b.distance <= r);
        res.json(filtered);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getById = async (req, res) => {
    try {
        const db = await getDb();
        const b = await db.get('SELECT b.*, c.name as category_name FROM businesses b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?', req.params.id);
        if (!b) return res.status(404).json({ error: 'Business not found' });

        await db.run('UPDATE businesses SET view_count = view_count + 1 WHERE id = ?', req.params.id);
        b.photos = await db.all('SELECT * FROM business_photos WHERE business_id = ?', req.params.id);
        b.reviews = await db.all('SELECT r.*, u.name as reviewer_name FROM reviews r JOIN users u ON r.customer_id = u.id WHERE r.business_id = ? ORDER BY r.created_at DESC', req.params.id);
        b.deals = await db.all('SELECT * FROM deals WHERE business_id = ?', req.params.id);
        res.json(b);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
    try {
        const { name, description, category_id, city, area, address, phone, lat, lng } = req.body;
        if (!name) return res.status(400).json({ error: 'Business name required' });
        const db = await getDb();
        const result = await db.run(
            'INSERT INTO businesses (owner_id, name, description, category_id, city, area, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            req.user.id, name, description || '', category_id || null, city || '', area || '', address || '', phone || '', lat || null, lng || null
        );
        res.status(201).json({ id: result.lastID, message: 'Business created' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
    try {
        const db = await getDb();
        const b = await db.get('SELECT * FROM businesses WHERE id = ? AND owner_id = ?', req.params.id, req.user.id);
        if (!b) return res.status(404).json({ error: 'Not found or not owner' });
        const { name, description, category_id, city, area, address, phone, lat, lng } = req.body;
        await db.run(
            'UPDATE businesses SET name=?, description=?, category_id=?, city=?, area=?, address=?, phone=?, lat=?, lng=? WHERE id=?',
            name || b.name, description || b.description, category_id || b.category_id, city || b.city, area || b.area, address || b.address, phone || b.phone, lat || b.lat, lng || b.lng, req.params.id
        );
        res.json({ message: 'Updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.run('DELETE FROM businesses WHERE id = ? AND owner_id = ?', req.params.id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getCategories = async (req, res) => {
    try {
        const db = await getDb();
        res.json(await db.all('SELECT * FROM categories'));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.ownerDashboard = async (req, res) => {
    try {
        const db = await getDb();
        const businesses = await db.all('SELECT * FROM businesses WHERE owner_id = ?', req.user.id);

        const stats = [];
        for (const b of businesses) {
            const q = await db.get('SELECT COUNT(*) as c FROM ai_query_log WHERE business_id = ?', b.id);
            const recent = await db.all('SELECT question, created_at FROM ai_query_log WHERE business_id = ? ORDER BY created_at DESC LIMIT 10', b.id);
            stats.push({ ...b, queryCount: q.c, recentQueries: recent });
        }
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
