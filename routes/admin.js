const express = require('express');
const router = express.Router();

// Import existing controllers
const { adminLogin, adminLogout, verifyAdminSession, getAdminProfile } = require('../controllers/adminAuthController');
const { getDashboardOverview, getRecentActivities, getPlatformAnalytics } = require('../controllers/adminDashboardController');
const { getAllUsers, getUserDetails, updateUserStatus } = require('../controllers/adminUserController');
const { getAllPolicyRequests, getPolicyDetails, updatePolicyStatus, getPolicyStatistics } = require('../controllers/adminPolicyController');
const { getAllClaims, getClaimDetails, updateClaimStatus, processClaimPayment, getClaimsStatistics } = require('../controllers/adminClaimsController');
const { getAllMessages, getMessageThread, replyToMessage, updateMessageStatus, getMessageStatistics } = require('../controllers/adminMessageController');

// Import NEW controllers
const {
  getAnalyticsOverview,
  getTrafficOverview,
  getTopPagesAnalytics,
  getDeviceAnalytics,
  getRealTimeActivity
} = require('../controllers/adminAnalyticsController');

const {
  getRevenueOverview,
  getRevenueTrends,
  getRevenueByCategory,
  getTopEarningPolicies,
  getTransactionAnalytics
} = require('../controllers/adminRevenueController');

// ===== AUTH ROUTES =====
router.post('/auth/login', adminLogin);
router.post('/auth/logout', verifyAdminSession, adminLogout);
router.get('/auth/profile', verifyAdminSession, getAdminProfile);

// ===== DASHBOARD ROUTES =====
router.get('/dashboard/overview', verifyAdminSession, getDashboardOverview);
router.get('/dashboard/activities', verifyAdminSession, getRecentActivities);
router.get('/dashboard/analytics', verifyAdminSession, getPlatformAnalytics);

// ===== NEW ANALYTICS ROUTES =====
router.get('/analytics/overview', verifyAdminSession, getAnalyticsOverview);
router.get('/analytics/traffic', verifyAdminSession, getTrafficOverview);
router.get('/analytics/pages', verifyAdminSession, getTopPagesAnalytics);
router.get('/analytics/devices', verifyAdminSession, getDeviceAnalytics);
router.get('/analytics/realtime', verifyAdminSession, getRealTimeActivity);

// ===== NEW REVENUE ROUTES =====
router.get('/revenue/overview', verifyAdminSession, getRevenueOverview);
router.get('/revenue/trends', verifyAdminSession, getRevenueTrends);
router.get('/revenue/categories', verifyAdminSession, getRevenueByCategory);
router.get('/revenue/policies', verifyAdminSession, getTopEarningPolicies);
router.get('/revenue/transactions', verifyAdminSession, getTransactionAnalytics);

// ===== EXISTING ROUTES =====
// User Management
router.get('/users', verifyAdminSession, getAllUsers);
router.get('/users/:wallet_address', verifyAdminSession, getUserDetails);
router.patch('/users/:wallet_address/status', verifyAdminSession, updateUserStatus);

// Policy Management
router.get('/policies', verifyAdminSession, getAllPolicyRequests);
router.get('/policies/statistics', verifyAdminSession, getPolicyStatistics);
router.get('/policies/:policy_id', verifyAdminSession, getPolicyDetails);
router.patch('/policies/:policy_id/status', verifyAdminSession, updatePolicyStatus);

// Claims Management
router.get('/claims', verifyAdminSession, getAllClaims);
router.get('/claims/statistics', verifyAdminSession, getClaimsStatistics);
router.get('/claims/:claim_id', verifyAdminSession, getClaimDetails);
router.patch('/claims/:claim_id/status', verifyAdminSession, updateClaimStatus);
router.post('/claims/:claim_id/payment', verifyAdminSession, processClaimPayment);

// Message Management
router.get('/messages', verifyAdminSession, getAllMessages);
router.get('/messages/statistics', verifyAdminSession, getMessageStatistics);
router.get('/messages/:message_id', verifyAdminSession, getMessageThread);
router.post('/messages/:message_id/reply', verifyAdminSession, replyToMessage);
router.patch('/messages/:message_id/status', verifyAdminSession, updateMessageStatus);

module.exports = router;