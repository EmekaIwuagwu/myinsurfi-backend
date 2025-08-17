const { getConnection } = require('../config/database');

// Get notification count
const getNotificationCount = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address is required' 
      });
    }

    const connection = getConnection();
    
    const [notificationResult] = await connection.execute(
      'SELECT COUNT(*) as notification_count FROM notifications WHERE wallet_address = ? AND is_read = FALSE',
      [wallet_address]
    );

    const [messageResult] = await connection.execute(
      'SELECT COUNT(*) as message_count FROM messages WHERE wallet_address = ? AND is_read = FALSE',
      [wallet_address]
    );

    const totalCount = notificationResult[0].notification_count + messageResult[0].message_count;

    res.json({
      success: true,
      data: {
        total_count: totalCount,
        notification_count: notificationResult[0].notification_count,
        message_count: messageResult[0].message_count
      }
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all messages for sidebar
const getMessages = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address is required' 
      });
    }

    const connection = getConnection();
    
    const [messages] = await connection.execute(
      `SELECT 
         id, subject, 
         LEFT(message, 100) as preview,
         sender_type, priority, is_read, created_at,
         (SELECT COUNT(*) FROM messages m2 WHERE m2.parent_message_id = messages.id) as reply_count
       FROM messages 
       WHERE wallet_address = ? AND parent_message_id IS NULL
       ORDER BY created_at DESC`,
      [wallet_address]
    );

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get full message with replies
const getFullMessage = async (req, res) => {
  try {
    const { message_id } = req.params;
    const { wallet_address } = req.query;

    if (!message_id || !wallet_address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message ID and wallet address are required' 
      });
    }

    const connection = getConnection();
    
    // Get main message
    const [mainMessage] = await connection.execute(
      'SELECT * FROM messages WHERE id = ? AND wallet_address = ?',
      [message_id, wallet_address]
    );

    if (mainMessage.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Get replies
    const [replies] = await connection.execute(
      'SELECT * FROM messages WHERE parent_message_id = ? ORDER BY created_at ASC',
      [message_id]
    );

    // Mark as read
    await connection.execute(
      'UPDATE messages SET is_read = TRUE WHERE id = ?',
      [message_id]
    );

    res.json({
      success: true,
      data: {
        main_message: mainMessage[0],
        replies: replies
      }
    });
  } catch (error) {
    console.error('Error fetching full message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create new message
const createMessage = async (req, res) => {
  try {
    const {
      wallet_address,
      subject,
      message,
      priority = 'low',
      parent_message_id = null
    } = req.body;

    if (!wallet_address || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address, subject, and message are required' 
      });
    }

    const connection = getConnection();
    
    const [result] = await connection.execute(
      `INSERT INTO messages 
       (wallet_address, sender_type, subject, message, priority, parent_message_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [wallet_address, 'user', subject, message, priority, parent_message_id]
    );

    // Create notification for admin
    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      ['admin', 'new_message', 'New Message Received', 
       `New message from ${wallet_address}: ${subject}`]
    );

    res.status(201).json({
      success: true,
      message: 'Message created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Reply to message
const replyToMessage = async (req, res) => {
  try {
    const {
      wallet_address,
      message,
      parent_message_id,
      sender_type = 'user'
    } = req.body;

    if (!wallet_address || !message || !parent_message_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address, message, and parent message ID are required' 
      });
    }

    const connection = getConnection();
    
    // Get parent message subject
    const [parentMessage] = await connection.execute(
      'SELECT subject FROM messages WHERE id = ?',
      [parent_message_id]
    );

    if (parentMessage.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent message not found'
      });
    }

    const subject = `Re: ${parentMessage[0].subject}`;

    const [result] = await connection.execute(
      `INSERT INTO messages 
       (wallet_address, sender_type, subject, message, parent_message_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [wallet_address, sender_type, subject, message, parent_message_id]
    );

    res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error replying to message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getNotificationCount,
  getMessages,
  getFullMessage,
  createMessage,
  replyToMessage
};