const express = require('express');
const router = express.Router();
const {
  createHomeInsuranceQuote,
  createCarInsuranceQuote,
  createTravelInsuranceQuote,
  getActivePolicies,
  getPolicyById
} = require('../controllers/insuranceController');

// Insurance quote routes
router.post('/home-quote', createHomeInsuranceQuote);
router.post('/car-quote', createCarInsuranceQuote);          // NOW SUPPORTS coverage_amount
router.post('/travel-quote', createTravelInsuranceQuote);    // NOW SUPPORTS coverage_amount

// Active policies route (list all for user)
router.get('/active-policies/:wallet_address', getActivePolicies);

// NEW: Get single policy by ID (this is what you need for the detail page)
router.get('/policy/:policy_id', getPolicyById);

module.exports = router;