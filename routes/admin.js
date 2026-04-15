const express = require('express');
const router = express.Router();
const { getDashboard, getAllUsers, toggleBlockUser } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getAllUsers);
router.put('/users/:id/block', toggleBlockUser);

module.exports = router;
