// Add to routes/user.js (create this file)
const express = require('express');
const router = express.Router();
const {
  getUserPolicyStatus,
  getUserPolicyDetails, 
  requestPolicyModification,
  getPolicySummary
} = require('../controllers/userPolicyController');

const {
  getUserProfile,
  updateUserProfile,
  getUserDashboard
} = require('../controllers/userProfileController');

// Policy routes
router.get('/policies/:wallet_address/status', getUserPolicyStatus);
router.get('/policies/:policy_id/details', getUserPolicyDetails);  
router.post('/policies/:policy_id/modify', requestPolicyModification);
router.get('/policies/:wallet_address/summary', getPolicySummary);

// Profile & Dashboard routes
router.get('/profile/:wallet_address', getUserProfile);
router.put('/profile/:wallet_address', updateUserProfile);
router.get('/dashboard/:wallet_address', getUserDashboard);

module.exports = router;