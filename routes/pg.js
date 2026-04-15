const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getAllPGs, getPGById, createPG, updatePG, deletePG, deleteImage, getMyPGs
} = require('../controllers/pgController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

const pgValidation = [
  body('name').trim().notEmpty().withMessage('PG name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('address.street').notEmpty().withMessage('Street is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.pincode').notEmpty().withMessage('Pincode is required'),
  body('genderType').isIn(['male', 'female', 'coed']).withMessage('Invalid gender type'),
  body('contactPhone').notEmpty().withMessage('Contact phone is required')
];

// Public
router.get('/', getAllPGs);
router.get('/admin/my-pgs', protect, authorize('admin'), getMyPGs);
router.get('/:id', getPGById);

// Admin protected
router.post('/', protect, authorize('admin'), upload.array('images', 10), pgValidation, createPG);
router.put('/:id', protect, authorize('admin'), upload.array('images', 10), updatePG);
router.delete('/:id', protect, authorize('admin'), deletePG);
router.delete('/:id/images/:imageIndex', protect, authorize('admin'), deleteImage);

module.exports = router;
