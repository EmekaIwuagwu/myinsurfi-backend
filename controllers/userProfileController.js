const { getConnection } = require('../config/database');

// Get User Profile
const getUserProfile = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    // Try to get user profile from user_profiles table
    let userProfile = null;
    try {
      const [profiles] = await connection.execute(
        'SELECT * FROM user_profiles WHERE wallet_address = ?',
        [wallet_address]
      );
      userProfile = profiles[0];
    } catch (tableError) {
      // Table might not exist, we'll create a default profile
    }

    // If no profile exists, create one from existing data
    if (!userProfile) {
      // Get user's first policy to extract any stored personal info
      const [homeData] = await connection.execute(
        'SELECT property_owner_name, property_owner_email, property_owner_telephone, created_at FROM home_insurance_quotes WHERE wallet_address = ? LIMIT 1',
        [wallet_address]
      );

      if (homeData.length > 0) {
        const data = homeData[0];
        userProfile = {
          wallet_address,
          name: data.property_owner_name || null,
          email: data.property_owner_email || null,
          phone: data.property_owner_telephone || null,
          created_at: data.created_at,
          verified: false,
          avatar_url: null
        };

        // Try to save this profile for future use
        try {
          await connection.execute(`
            INSERT IGNORE INTO user_profiles (wallet_address, name, email, phone, created_at)
            VALUES (?, ?, ?, ?, ?)
          `, [wallet_address, userProfile.name, userProfile.email, userProfile.phone, userProfile.created_at]);
        } catch (insertError) {
          // Continue even if insert fails
        }
      } else {
        // Create minimal profile
        userProfile = {
          wallet_address,
          name: null,
          email: null,
          phone: null,
          created_at: new Date(),
          verified: false,
          avatar_url: null
        };
      }
    }

    res.json({
      success: true,
      data: userProfile
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create or Update User Profile
const updateUserProfile = async (req, res) => {
  try {
    const { wallet_address } = req.params;
    const { name, email, phone, avatar_url } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    // Create user_profiles table if it doesn't exist
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          wallet_address VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(20),
          avatar_url VARCHAR(500),
          verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_wallet (wallet_address),
          INDEX idx_email (email)
        )
      `);
    } catch (createError) {
      // Continue if table creation fails
    }

    // Insert or update profile
    await connection.execute(`
      INSERT INTO user_profiles (wallet_address, name, email, phone, avatar_url)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      phone = VALUES(phone),
      avatar_url = VALUES(avatar_url),
      updated_at = CURRENT_TIMESTAMP
    `, [wallet_address, name, email, phone, avatar_url]);

    // Get updated profile
    const [profiles] = await connection.execute(
      'SELECT * FROM user_profiles WHERE wallet_address = ?',
      [wallet_address]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profiles[0]
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get User Dashboard
const getUserDashboard = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    // Get policies count and premium total
    const [homePolicies] = await connection.execute(
      'SELECT COUNT(*) as count, COALESCE(SUM(total_premium), 0) as total_premium, MAX(created_at) as latest FROM home_insurance_quotes WHERE wallet_address = ?',
      [wallet_address]
    );

    const [carPolicies] = await connection.execute(
      'SELECT COUNT(*) as count, MAX(created_at) as latest FROM car_insurance_quotes WHERE wallet_address = ?',
      [wallet_address]
    );

    const [travelPolicies] = await connection.execute(
      'SELECT COUNT(*) as count, MAX(created_at) as latest FROM travel_insurance_quotes WHERE wallet_address = ?',
      [wallet_address]
    );

    // Get claims statistics
    const [claimsStats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_claims,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_claims,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_claims,
        COALESCE(SUM(claim_amount), 0) as total_claimed,
        COALESCE(SUM(payout_amount), 0) as total_received
      FROM insurance_claims 
      WHERE wallet_address = ?`,
      [wallet_address]
    );

    // Get recent activities
    const [recentClaims] = await connection.execute(
      'SELECT claim_id, policy_type, claim_amount, status, created_at FROM insurance_claims WHERE wallet_address = ? ORDER BY created_at DESC LIMIT 5',
      [wallet_address]
    );

    const [recentPolicies] = await connection.execute(
      `(SELECT id, 'home' as type, house_type as detail, total_premium as premium, created_at FROM home_insurance_quotes WHERE wallet_address = ?)
       UNION
       (SELECT id, 'car' as type, CONCAT(car_make, ' ', car_model) as detail, NULL as premium, created_at FROM car_insurance_quotes WHERE wallet_address = ?)
       UNION
       (SELECT id, 'travel' as type, CONCAT(origin, ' to ', destination) as detail, NULL as premium, created_at FROM travel_insurance_quotes WHERE wallet_address = ?)
       ORDER BY created_at DESC LIMIT 5`,
      [wallet_address, wallet_address, wallet_address]
    );

    // Get unread notifications count
    const [notificationCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE wallet_address = ? AND is_read = FALSE',
      [wallet_address]
    );

    // Get upcoming policy renewals (policies ending in next 30 days)
    const [upcomingRenewals] = await connection.execute(
      `(SELECT id, 'home' as type, house_type as detail, policy_end_date as renewal_date FROM home_insurance_quotes WHERE wallet_address = ? AND policy_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))
       UNION
       (SELECT id, 'car' as type, CONCAT(car_make, ' ', car_model) as detail, policy_end_date as renewal_date FROM car_insurance_quotes WHERE wallet_address = ? AND policy_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))
       ORDER BY renewal_date ASC`,
      [wallet_address, wallet_address]
    );

    const dashboard = {
      overview: {
        total_policies: homePolicies[0].count + carPolicies[0].count + travelPolicies[0].count,
        total_premium_paid: parseFloat(homePolicies[0].total_premium || 0),
        total_claims: claimsStats[0].total_claims,
        pending_claims: claimsStats[0].pending_claims,
        unread_notifications: notificationCount[0].count
      },
      policies: {
        home: {
          count: homePolicies[0].count,
          total_premium: parseFloat(homePolicies[0].total_premium || 0),
          latest: homePolicies[0].latest
        },
        car: {
          count: carPolicies[0].count,
          latest: carPolicies[0].latest
        },
        travel: {
          count: travelPolicies[0].count,
          latest: travelPolicies[0].latest
        }
      },
      claims: {
        total: claimsStats[0].total_claims,
        pending: claimsStats[0].pending_claims,
        approved: claimsStats[0].approved_claims,
        paid: claimsStats[0].paid_claims,
        total_claimed: parseFloat(claimsStats[0].total_claimed || 0),
        total_received: parseFloat(claimsStats[0].total_received || 0)
      },
      recent_activities: {
        claims: recentClaims.map(claim => ({
          ...claim,
          formatted_amount: parseFloat(claim.claim_amount).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
          })
        })),
        policies: recentPolicies.map(policy => ({
          ...policy,
          formatted_premium: policy.premium ? parseFloat(policy.premium).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
          }) : null
        }))
      },
      upcoming_renewals: upcomingRenewals,
      financial_summary: {
        total_premium_paid: parseFloat(homePolicies[0].total_premium || 0),
        total_claimed: parseFloat(claimsStats[0].total_claimed || 0),
        total_received: parseFloat(claimsStats[0].total_received || 0),
        pending_claims_value: parseFloat(claimsStats[0].total_claimed || 0) - parseFloat(claimsStats[0].total_received || 0)
      }
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get User Statistics for Admin
const getUserStatistics = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    // Get comprehensive user statistics
    const [userStats] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM home_insurance_quotes WHERE wallet_address = ?) as home_policies,
        (SELECT COUNT(*) FROM car_insurance_quotes WHERE wallet_address = ?) as car_policies,
        (SELECT COUNT(*) FROM travel_insurance_quotes WHERE wallet_address = ?) as travel_policies,
        (SELECT COALESCE(SUM(total_premium), 0) FROM home_insurance_quotes WHERE wallet_address = ?) as total_premium,
        (SELECT COUNT(*) FROM insurance_claims WHERE wallet_address = ?) as total_claims,
        (SELECT COUNT(*) FROM insurance_claims WHERE wallet_address = ? AND status = 'paid') as paid_claims,
        (SELECT COALESCE(SUM(payout_amount), 0) FROM insurance_claims WHERE wallet_address = ? AND status = 'paid') as total_payouts,
        (SELECT COUNT(*) FROM messages WHERE wallet_address = ?) as total_messages,
        (SELECT MIN(created_at) FROM (
          SELECT created_at FROM home_insurance_quotes WHERE wallet_address = ?
          UNION ALL
          SELECT created_at FROM car_insurance_quotes WHERE wallet_address = ?
          UNION ALL
          SELECT created_at FROM travel_insurance_quotes WHERE wallet_address = ?
        ) as all_activities) as first_activity,
        (SELECT MAX(created_at) FROM (
          SELECT created_at FROM home_insurance_quotes WHERE wallet_address = ?
          UNION ALL
          SELECT created_at FROM car_insurance_quotes WHERE wallet_address = ?
          UNION ALL
          SELECT created_at FROM travel_insurance_quotes WHERE wallet_address = ?
          UNION ALL
          SELECT created_at FROM insurance_claims WHERE wallet_address = ?
          UNION ALL
          SELECT created_at FROM messages WHERE wallet_address = ?
        ) as all_activities) as last_activity
    `, Array(16).fill(wallet_address));

    res.json({
      success: true,
      data: userStats[0]
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserDashboard,
  getUserStatistics
};