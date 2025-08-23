const { getConnection } = require('../config/database');

// Helper function to calculate time ago
// Helper function to calculate time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

// FIXED: Simplified getAllMessages function
const getAllMessages = async (req, res) => {
  try {
    const connection = getConnection();

    // Simple pagination - default values
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Optional filters
    const status = req.query.status || 'all';
    const priority = req.query.priority || 'all';

    // Build WHERE conditions
    let whereConditions = ['m.parent_message_id IS NULL']; // Only get parent messages
    let queryParams = [];

    if (status !== 'all') {
      whereConditions.push('m.status = ?');
      queryParams.push(status);
    }

    if (priority !== 'all') {
      whereConditions.push('m.priority = ?');
      queryParams.push(priority);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get messages with admin info - SIMPLE query
    const [messages] = await connection.execute(`
      SELECT 
        m.id,
        m.wallet_address,
        m.sender_type,
        m.subject,
        m.message,
        m.parent_message_id,
        m.priority,
        m.status,
        m.is_read,
        m.admin_assigned,
        m.created_at,
        m.updated_at,
        a.name as assigned_admin_name,
        (SELECT COUNT(*) FROM messages m2 WHERE m2.parent_message_id = m.id) as reply_count
      FROM messages m
      LEFT JOIN admin_users a ON m.admin_assigned = a.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, queryParams);

    // Get total count for pagination
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total
      FROM messages m
      WHERE ${whereClause}
    `, queryParams);

    // Enhance messages with customer info
    const { generateNameFromWallet } = require('./adminUserController');

    const enhancedMessages = messages.map(message => ({
      ...message,
      customer: generateNameFromWallet(message.wallet_address),
      formatted_wallet: `${message.wallet_address.slice(0, 6)}...${message.wallet_address.slice(-4)}`,
      message_preview: message.message.length > 100 ?
        message.message.substring(0, 100) + '...' :
        message.message,
      time_ago: getTimeAgo(message.created_at)
    }));

    res.json({
      success: true,
      data: {
        messages: enhancedMessages,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(countResult[0].total / limit),
          total_messages: countResult[0].total,
          per_page: limit
        }
      }
    });
  } catch (error) {
    console.error('Get all messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Message Thread
const getMessageThread = async (req, res) => {
  try {
    const { message_id } = req.params;

    if (!message_id) {
      return res.status(400).json({
        success: false,
        message: 'Message ID is required'
      });
    }

    const connection = getConnection();

    // Get main message
    const [mainMessage] = await connection.execute(`
      SELECT 
        m.id,
        m.wallet_address,
        m.sender_type,
        m.subject,
        m.message,
        m.parent_message_id,
        m.priority,
        m.status,
        m.is_read,
        m.admin_assigned,
        m.created_at,
        m.updated_at,
        a.name as assigned_admin_name,
        a.email as assigned_admin_email
      FROM messages m
      LEFT JOIN admin_users a ON m.admin_assigned = a.id
      WHERE m.id = ${message_id}
    `);

    if (mainMessage.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Get replies - SIMPLIFIED without problematic JOIN
    const [replies] = await connection.execute(`
      SELECT 
        m.id,
        m.wallet_address,
        m.sender_type,
        m.subject,
        m.message,
        m.created_at,
        m.updated_at
      FROM messages m
      WHERE m.parent_message_id = ${message_id}
      ORDER BY m.created_at ASC
    `);

    // Mark main message as read
    await connection.execute(`
      UPDATE messages SET is_read = TRUE WHERE id = ${message_id}
    `);

    // Enhance with customer info
    const { generateNameFromWallet, generateEmailFromWallet } = require('./adminUserController');

    const enhancedMessage = {
      ...mainMessage[0],
      customer: generateNameFromWallet(mainMessage[0].wallet_address),
      customer_email: generateEmailFromWallet(mainMessage[0].wallet_address),
      formatted_wallet: `${mainMessage[0].wallet_address.slice(0, 6)}...${mainMessage[0].wallet_address.slice(-4)}`,
      time_ago: getTimeAgo(mainMessage[0].created_at),
      replies: replies.map(reply => ({
        ...reply,
        sender_display_name: reply.sender_type === 'admin' ?
          'Admin' :
          generateNameFromWallet(reply.wallet_address),
        time_ago: getTimeAgo(reply.created_at)
      }))
    };

    res.json({
      success: true,
      data: enhancedMessage
    });
  } catch (error) {
    console.error('Get message thread error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Reply to Message
const replyToMessage = async (req, res) => {
  try {
    const { message_id } = req.params;
    const { message, internal_note } = req.body;

    if (!message_id || !message) {
      return res.status(400).json({
        success: false,
        message: 'Message ID and message content are required'
      });
    }

    const connection = getConnection();

    // Get original message
    const [originalMessage] = await connection.execute(
      'SELECT * FROM messages WHERE id = ?',
      [message_id]
    );

    if (originalMessage.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Original message not found'
      });
    }

    const subject = `Re: ${originalMessage[0].subject}`;

    // Insert reply
    const [result] = await connection.execute(`
      INSERT INTO messages 
      (wallet_address, sender_type, subject, message, parent_message_id, priority, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      originalMessage[0].wallet_address,
      'admin',
      subject,
      message,
      message_id,
      originalMessage[0].priority,
      'open'
    ]);

    // Update original message status to in_progress if it was open
    if (originalMessage[0].status === 'open') {
      await connection.execute(
        'UPDATE messages SET status = ?, admin_assigned = ? WHERE id = ?',
        ['in_progress', req.admin.admin_id, message_id]
      );
    }

    // Create notification for user
    await connection.execute(`
      INSERT INTO notifications (wallet_address, type, title, message)
      VALUES (?, ?, ?, ?)
    `, [
      originalMessage[0].wallet_address,
      'message_reply',
      'New Reply',
      `Admin replied to your message: ${originalMessage[0].subject}`
    ]);

    // Log admin activity
    await connection.execute(`
      INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.admin.admin_id,
      'reply_message',
      'message',
      message_id,
      JSON.stringify({ reply_id: result.insertId, internal_note })
    ]);

    res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      data: { reply_id: result.insertId }
    });
  } catch (error) {
    console.error('Reply to message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update Message Status
const updateMessageStatus = async (req, res) => {
  try {
    const { message_id } = req.params;
    const { status, priority, admin_assigned } = req.body;

    if (!message_id) {
      return res.status(400).json({
        success: false,
        message: 'Message ID is required'
      });
    }

    const connection = getConnection();

    // Build update query
    let updateFields = [];
    let updateValues = [];

    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (priority) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }

    if (admin_assigned !== undefined) {
      updateFields.push('admin_assigned = ?');
      updateValues.push(admin_assigned);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(message_id);

    await connection.execute(`
      UPDATE messages 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `, updateValues);

    // Log admin activity
    await connection.execute(`
      INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.admin.admin_id,
      'update_message',
      'message',
      message_id,
      JSON.stringify({ status, priority, admin_assigned })
    ]);

    res.json({
      success: true,
      message: 'Message updated successfully'
    });
  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Message Statistics
const getMessageStatistics = async (req, res) => {
  try {
    const connection = getConnection();

    // Get counts by status
    const [statusStats] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM messages
      WHERE parent_message_id IS NULL
      GROUP BY status
    `);

    // Get counts by priority
    const [priorityStats] = await connection.execute(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM messages
      WHERE parent_message_id IS NULL
      GROUP BY priority
    `);

    // Get response time statistics
    const [responseStats] = await connection.execute(`
      SELECT 
        AVG(TIMESTAMPDIFF(HOUR, m1.created_at, m2.created_at)) as avg_response_time_hours,
        COUNT(*) as responded_messages
      FROM messages m1
      JOIN messages m2 ON m1.id = m2.parent_message_id
      WHERE m1.parent_message_id IS NULL 
        AND m2.sender_type = 'admin'
        AND m1.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Get daily message counts for the last 7 days
    const [dailyStats] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM messages
      WHERE parent_message_id IS NULL
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        by_status: statusStats,
        by_priority: priorityStats,
        response_time: responseStats[0] || { avg_response_time_hours: 0, responded_messages: 0 },
        daily_counts: dailyStats
      }
    });
  } catch (error) {
    console.error('Get message statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getAllMessages,
  getMessageThread,
  replyToMessage,
  updateMessageStatus,
  getMessageStatistics,
  getTimeAgo
};