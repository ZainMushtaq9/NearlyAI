const express = require('express');
const router = express.Router();
const biz = require('../controllers/businessController');
const ai = require('../controllers/aiController');
const { authMiddleware, ownerGuard } = require('../middleware/auth');

router.get('/categories', biz.getCategories);
router.get('/', biz.getAll);
router.get('/nearby', biz.getNearby);
router.get('/:id', biz.getById);
router.post('/', authMiddleware, ownerGuard, biz.create);
router.put('/:id', authMiddleware, biz.update);
router.delete('/:id', authMiddleware, biz.remove);
router.get('/owner/dashboard', authMiddleware, ownerGuard, biz.ownerDashboard);

// AI endpoints
router.post('/ai/generate-profile', authMiddleware, ai.generateProfile);
router.post('/:id/ai/query', ai.customerQuery);

module.exports = router;
