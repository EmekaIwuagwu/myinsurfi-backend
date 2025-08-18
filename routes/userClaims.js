const express = require('express');
const router = express.Router();
const {
  submitClaimWithFiles, // Updated import
  getUserClaims,
  getClaimStatus,
  uploadClaimDocuments
} = require('../controllers/userClaimsController');

// Submit new claim with file uploads
router.post('/submit', submitClaimWithFiles); // This now handles file uploads

// Get user's claims with pagination and filtering
router.get('/:wallet_address', getUserClaims);

// Get specific claim status
router.get('/:claim_id/status', getClaimStatus);

// Upload additional documents for a claim
router.post('/:claim_id/documents', uploadClaimDocuments);

module.exports = router;