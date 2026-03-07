require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5002;
const initDatabase = require('./src/utils/initDb');

app.use(cors({ origin: ['http://localhost:5175', 'http://localhost:3000'] }));
app.use(express.json());

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/businesses', require('./src/routes/businessRoutes'));
app.use('/api', require('./src/routes/featureRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'NearlyAI', timestamp: new Date().toISOString() }));

app.get('/api', (req, res) => res.json({
    name: 'NearlyAI API',
    version: '1.0.0',
    endpoints: {
        auth: 'POST /register, POST /login, GET /profile',
        businesses: 'GET /, GET /nearby, GET /:id, POST /, PUT /:id, DELETE /:id',
        categories: 'GET /businesses/categories',
        ai: 'POST /businesses/ai/generate-profile, POST /businesses/:id/ai/query',
        reviews: 'POST /, GET /business/:id, POST /:id/flag',
        deals: 'POST /, DELETE /:id',
        favourites: 'POST /:id (toggle), GET /',
        admin: 'GET /stats, GET /pending, POST /verify/:id, POST /suspend/:id, GET /flagged-reviews'
    }
}));

// Initialize DB then start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 NearlyAI backend running on http://localhost:${PORT}`);
        console.log(`📋 API docs at http://localhost:${PORT}/api`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
