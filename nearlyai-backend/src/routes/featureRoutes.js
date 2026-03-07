const express = require('express');
const router = express.Router();
const feat = require('../controllers/featureController');
const { authMiddleware } = require('../middleware/auth');

// Reviews
router.post('/reviews', authMiddleware, feat.create);
router.get('/reviews/business/:id', feat.getByBusiness);
router.post('/reviews/:id/flag', authMiddleware, feat.flag);

// Deals
router.post('/deals', authMiddleware, feat.createDeal);
router.delete('/deals/:id', authMiddleware, feat.deleteDeal);

// Favourites
router.post('/favourites/:id', authMiddleware, feat.toggleFavourite);
router.get('/favourites', authMiddleware, feat.getFavourites);

// Photos
router.post('/photos', authMiddleware, feat.addPhoto);

module.exports = router;
