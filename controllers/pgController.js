const { validationResult } = require('express-validator');
const PG = require('../models/PG');
const { asyncHandler, AppError, formatValidationErrors } = require('../middleware/errorHandler');
const { cloudinary } = require('../config/cloudinary');

// @route   GET /api/pgs
// @access  Public - all listings
const getAllPGs = asyncHandler(async (req, res) => {
  const {
    city, minPrice, maxPrice, genderType, amenities,
    page = 1, limit = 12, search, sort = '-createdAt'
  } = req.query;

  const query = { isActive: true };

  // Search by name or city
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (city) query['address.city'] = { $regex: city, $options: 'i' };
  if (genderType) query.genderType = genderType;

  if (amenities) {
    const amenityList = amenities.split(',').map(a => a.trim());
    query.amenities = { $all: amenityList };
  }

  // Filter by price range (any room type within range)
  if (minPrice || maxPrice) {
    const priceFilter = {};
    if (minPrice) priceFilter.$gte = Number(minPrice);
    if (maxPrice) priceFilter.$lte = Number(maxPrice);
    query['roomTypes.price'] = priceFilter;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await PG.countDocuments(query);

  const pgs = await PG.find(query)
    .populate('owner', 'name email phone')
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    count: pgs.length,
    pgs
  });
});

// @route   GET /api/pgs/:id
// @access  Public
const getPGById = asyncHandler(async (req, res) => {
  const pg = await PG.findById(req.params.id).populate('owner', 'name email phone avatar');
  if (!pg) throw new AppError('PG not found', 404);
  res.json({ success: true, pg });
});

// @route   POST /api/pgs
// @access  Admin only
const createPG = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const pgData = { ...req.body, owner: req.user._id };

  // Handle uploaded images
  if (req.files && req.files.length > 0) {
    pgData.images = req.files.map(file => file.path);
  }

  const pg = await PG.create(pgData);
  await pg.populate('owner', 'name email');

  res.status(201).json({ success: true, message: 'PG created successfully', pg });
});

// @route   PUT /api/pgs/:id
// @access  Admin (owner only)
const updatePG = asyncHandler(async (req, res) => {
  let pg = await PG.findById(req.params.id);
  if (!pg) throw new AppError('PG not found', 404);

  // CRITICAL: Ensure admin can only update their own PGs
  if (pg.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to update this PG', 403);
  }

  const updateData = { ...req.body };

  // Add new images if uploaded
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map(file => file.path);
    updateData.images = [...(pg.images || []), ...newImages];
  }

  pg = await PG.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  }).populate('owner', 'name email');

  res.json({ success: true, message: 'PG updated successfully', pg });
});

// @route   DELETE /api/pgs/:id
// @access  Admin (owner only)
const deletePG = asyncHandler(async (req, res) => {
  const pg = await PG.findById(req.params.id);
  if (!pg) throw new AppError('PG not found', 404);

  // CRITICAL: Ensure admin can only delete their own PGs
  if (pg.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to delete this PG', 403);
  }

  // Delete images from Cloudinary
  if (pg.images && pg.images.length > 0) {
    const deletePromises = pg.images.map(imageUrl => {
      const publicId = imageUrl.split('/').pop().split('.')[0];
      return cloudinary.uploader.destroy(`pg-management/${publicId}`);
    });
    await Promise.allSettled(deletePromises);
  }

  await pg.deleteOne();
  res.json({ success: true, message: 'PG deleted successfully' });
});

// @route   DELETE /api/pgs/:id/images/:imageIndex
// @access  Admin (owner only)
const deleteImage = asyncHandler(async (req, res) => {
  const pg = await PG.findById(req.params.id);
  if (!pg) throw new AppError('PG not found', 404);

  if (pg.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized', 403);
  }

  const imageIndex = Number(req.params.imageIndex);
  if (imageIndex < 0 || imageIndex >= pg.images.length) {
    throw new AppError('Image not found', 404);
  }

  const imageUrl = pg.images[imageIndex];
  const publicId = 'pg-management/' + imageUrl.split('/').pop().split('.')[0];
  await cloudinary.uploader.destroy(publicId);

  pg.images.splice(imageIndex, 1);
  await pg.save();

  res.json({ success: true, message: 'Image deleted', images: pg.images });
});

// @route   GET /api/pgs/admin/my-pgs
// @access  Admin
const getMyPGs = asyncHandler(async (req, res) => {
  // CRITICAL: Only fetch admin's own PGs
  const pgs = await PG.find({ owner: req.user._id }).sort('-createdAt');
  res.json({ success: true, count: pgs.length, pgs });
});

module.exports = { getAllPGs, getPGById, createPG, updatePG, deletePG, deleteImage, getMyPGs };
