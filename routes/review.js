const express = require('express');
const router = express.Router();
const { getPGReviews, createReview, deleteReview } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');

router.get('/pg/:pgId', getPGReviews);
router.post('/:pgId', protect, authorize('user'), createReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
