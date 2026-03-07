const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { authMiddleware, adminGuard } = require('../middleware/auth');

router.use(authMiddleware, adminGuard);
router.get('/stats', admin.getStats);
router.get('/pending', admin.getPending);
router.post('/verify/:id', admin.verify);
router.post('/suspend/:id', admin.suspend);
router.get('/flagged-reviews', admin.getFlaggedReviews);
router.get('/users', admin.getUsers);
router.delete('/users/:id', admin.deleteUser);

module.exports = router;
