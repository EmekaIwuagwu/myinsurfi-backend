const express = require('express');
const router = express.Router();
const {
  createHomeInsuranceQuote,
  createCarInsuranceQuote,
  createTravelInsuranceQuote,
  getActivePolicies
} = require('../controllers/insuranceController');

// Insurance quote routes
router.post('/home-quote', createHomeInsuranceQuote);
router.post('/car-quote', createCarInsuranceQuote);
router.post('/travel-quote', createTravelInsuranceQuote);

// Active policies route
router.get('/active-policies/:wallet_address', getActivePolicies);

module.exports = router;