const express = require('express');
const router = express.Router();
const {
  getNotificationCount,
  getMessages,
  getFullMessage,
  createMessage,
  replyToMessage
} = require('../controllers/messageController');

// Notification and message routes
router.get('/notifications/count/:wallet_address', getNotificationCount);
router.get('/list/:wallet_address', getMessages);
router.get('/full/:message_id', getFullMessage);
router.post('/create', createMessage);
router.post('/reply', replyToMessage);

module.exports = router;