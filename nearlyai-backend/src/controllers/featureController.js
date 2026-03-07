const getDb = require('../utils/db');

exports.create = async (req, res) => {
    try {
        const { business_id, rating, comment } = req.body;
        if (!business_id || !rating) return res.status(400).json({ error: 'business_id and rating required' });

        const db = await getDb();

        // Check if review exists
        const existing = await db.get('SELECT id FROM reviews WHERE business_id = ? AND customer_id = ?', business_id, req.user.id);
        if (existing) return res.status(409).json({ error: 'Already reviewed this business' });

        await db.run('INSERT INTO reviews (business_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)', business_id, req.user.id, rating, comment || '');

        const stats = await db.get('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE business_id = ?', business_id);
        await db.run('UPDATE businesses SET avg_rating = ?, review_count = ? WHERE id = ?', Math.round(stats.avg * 10) / 10, stats.cnt, business_id);

        res.status(201).json({ message: 'Review posted', avg_rating: stats.avg, review_count: stats.cnt });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getByBusiness = async (req, res) => {
    try {
        const db = await getDb();
        res.json(await db.all('SELECT r.*, u.name as reviewer_name FROM reviews r JOIN users u ON r.customer_id = u.id WHERE r.business_id = ? ORDER BY r.created_at DESC', req.params.id));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.flag = async (req, res) => {
    try {
        const db = await getDb();
        await db.run('UPDATE reviews SET flagged = 1 WHERE id = ?', req.params.id);
        res.json({ message: 'Review flagged' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.removeReview = async (req, res) => {
    try {
        const db = await getDb();
        const r = await db.get('SELECT * FROM reviews WHERE id = ?', req.params.id);
        if (!r) return res.status(404).json({ error: 'Not found' });

        await db.run('DELETE FROM reviews WHERE id = ?', req.params.id);

        const stats = await db.get('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE business_id = ?', r.business_id);
        await db.run('UPDATE businesses SET avg_rating = ?, review_count = ? WHERE id = ?', stats.avg || 0, stats.cnt, r.business_id);

        res.json({ message: 'Review removed' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// Deals
exports.createDeal = async (req, res) => {
    try {
        const { business_id, title, description, discount_percent, valid_until } = req.body;
        if (!business_id || !title) return res.status(400).json({ error: 'business_id and title required' });

        const db = await getDb();
        const biz = await db.get('SELECT * FROM businesses WHERE id = ? AND owner_id = ?', business_id, req.user.id);
        if (!biz) return res.status(403).json({ error: 'Not your business' });

        const result = await db.run('INSERT INTO deals (business_id, title, description, discount_percent, valid_until) VALUES (?, ?, ?, ?, ?)', business_id, title, description || '', discount_percent || 0, valid_until || null);
        res.status(201).json({ id: result.lastID });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteDeal = async (req, res) => {
    try {
        const db = await getDb();
        await db.run('DELETE FROM deals WHERE id = ?', req.params.id);
        res.json({ message: 'Deal deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// Favourites
exports.toggleFavourite = async (req, res) => {
    try {
        const db = await getDb();
        const existing = await db.get('SELECT id FROM favourites WHERE user_id = ? AND business_id = ?', req.user.id, req.params.id);
        if (existing) {
            await db.run('DELETE FROM favourites WHERE id = ?', existing.id);
            res.json({ saved: false });
        } else {
            await db.run('INSERT INTO favourites (user_id, business_id) VALUES (?, ?)', req.user.id, req.params.id);
            res.json({ saved: true });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFavourites = async (req, res) => {
    try {
        const db = await getDb();
        res.json(await db.all('SELECT b.*, c.name as category_name FROM favourites f JOIN businesses b ON f.business_id = b.id LEFT JOIN categories c ON b.category_id = c.id WHERE f.user_id = ?', req.user.id));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// Photos
exports.addPhoto = async (req, res) => {
    try {
        const { business_id, photo_url } = req.body;
        if (!business_id || !photo_url) return res.status(400).json({ error: 'business_id and photo_url required' });
        const db = await getDb();
        await db.run('INSERT INTO business_photos (business_id, photo_url) VALUES (?, ?)', business_id, photo_url);
        res.status(201).json({ message: 'Photo added' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
