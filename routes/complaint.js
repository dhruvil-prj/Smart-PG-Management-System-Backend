const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getMyComplaints,
  getAdminComplaints,
  updateComplaintStatus
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('user'), createComplaint);
router.get('/my', protect, authorize('user'), getMyComplaints);
router.get('/admin/all', protect, authorize('admin'), getAdminComplaints);
router.put('/:id/status', protect, authorize('admin'), updateComplaintStatus);

module.exports = router;
