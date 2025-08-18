const { getConnection } = require('../config/database');
const crypto = require('crypto');

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    const connection = getConnection();
    
    // Find admin user
    const [adminUsers] = await connection.execute(
      'SELECT * FROM admin_users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (adminUsers.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const admin = adminUsers[0];

    // Simple password check (in production, use bcrypt)
    if (admin.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

    // Save session
    await connection.execute(
      'INSERT INTO admin_sessions (admin_id, session_token, expires_at) VALUES (?, ?, ?)',
      [admin.id, sessionToken, expiresAt]
    );

    // Update last login
    await connection.execute(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    // Log activity
    await connection.execute(
      'INSERT INTO admin_activity_log (admin_id, action, resource_type, ip_address) VALUES (?, ?, ?, ?)',
      [admin.id, 'login', 'session', req.ip]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        },
        token: sessionToken,
        expires_at: expiresAt
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Admin Logout
const adminLogout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token required'
      });
    }

    const connection = getConnection();

    // Delete session
    await connection.execute(
      'DELETE FROM admin_sessions WHERE session_token = ?',
      [token]
    );

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Verify Admin Session Middleware
const verifyAdminSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const connection = getConnection();

    // Check session
    const [sessions] = await connection.execute(`
      SELECT s.*, a.id as admin_id, a.email, a.name, a.role, a.is_active
      FROM admin_sessions s
      JOIN admin_users a ON s.admin_id = a.id
      WHERE s.session_token = ? AND s.expires_at > NOW() AND a.is_active = TRUE
    `, [token]);

    if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }

    req.admin = sessions[0];
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Admin Profile
const getAdminProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.admin.admin_id,
        email: req.admin.email,
        name: req.admin.name,
        role: req.admin.role
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  adminLogin,
  adminLogout,
  verifyAdminSession,
  getAdminProfile
};