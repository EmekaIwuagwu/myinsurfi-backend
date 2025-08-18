const { getConnection } = require('../config/database');

// Helper function to generate name from wallet
const generateNameFromWallet = (wallet) => {
  const names = ['John Smith', 'Jane Doe', 'Bob Johnson', 'Alice Wilson', 'Mike Davis'];
  const index = parseInt(wallet.slice(-1), 16) % names.length;
  return names[index];
};

// Helper function to generate email from wallet
const generateEmailFromWallet = (wallet) => {
  const name = generateNameFromWallet(wallet).toLowerCase().replace(' ', '.');
  return `${name}@example.com`;
};

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = 'all',
      sortBy = 'joined_date',
      sortOrder = 'DESC' 
    } = req.query;

    const connection = getConnection();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Aggregate user data
    const aggregatedUsers = {};
    
    // Get home insurance data
    const [homeData] = await connection.execute(`
      SELECT 
        wallet_address,
        COUNT(*) as policies,
        SUM(total_premium) as premium,
        MIN(created_at) as joined_date,
        MAX(created_at) as last_activity
      FROM home_insurance_quotes
      GROUP BY wallet_address
    `);

    // Get car insurance data  
    const [carData] = await connection.execute(`
      SELECT 
        wallet_address,
        COUNT(*) as policies,
        MIN(created_at) as joined_date,
        MAX(created_at) as last_activity
      FROM car_insurance_quotes
      GROUP BY wallet_address
    `);

    // Get travel insurance data
    const [travelData] = await connection.execute(`
      SELECT 
        wallet_address,
        COUNT(*) as policies,
        MIN(created_at) as joined_date,
        MAX(created_at) as last_activity
      FROM travel_insurance_quotes
      GROUP BY wallet_address
    `);

    // Get claims data
    const [claimsData] = await connection.execute(`
      SELECT 
        wallet_address,
        COUNT(*) as total_claims
      FROM insurance_claims
      GROUP BY wallet_address
    `);

    // Merge all data
    [...homeData, ...carData, ...travelData].forEach(item => {
      const wallet = item.wallet_address;
      if (!aggregatedUsers[wallet]) {
        aggregatedUsers[wallet] = {
          wallet_address: wallet,
          name: generateNameFromWallet(wallet),
          email: generateEmailFromWallet(wallet),
          status: 'Active',
          total_policies: 0,
          total_premium: 0,
          total_claims: 0,
          joined_date: item.joined_date,
          last_activity: item.last_activity
        };
      }
      
      aggregatedUsers[wallet].total_policies += item.policies || 0;
      aggregatedUsers[wallet].total_premium += parseFloat(item.premium || 0);
      
      // Update earliest join date
      if (new Date(item.joined_date) < new Date(aggregatedUsers[wallet].joined_date)) {
        aggregatedUsers[wallet].joined_date = item.joined_date;
      }
      
      // Update latest activity
      if (new Date(item.last_activity) > new Date(aggregatedUsers[wallet].last_activity)) {
        aggregatedUsers[wallet].last_activity = item.last_activity;
      }
    });

    // Add claims data
    claimsData.forEach(item => {
      if (aggregatedUsers[item.wallet_address]) {
        aggregatedUsers[item.wallet_address].total_claims = item.total_claims;
      }
    });

    // Convert to array and apply search filter
    let userList = Object.values(aggregatedUsers);
    
    if (search) {
      userList = userList.filter(user => 
        user.wallet_address.toLowerCase().includes(search.toLowerCase()) ||
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort users
    userList.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'DESC') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const totalUsers = userList.length;
    const paginatedUsers = userList.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalUsers / parseInt(limit)),
          total_users: totalUsers,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get User Details
const getUserDetails = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    // Get user's home insurance policies
    const [homePolicies] = await connection.execute(`
      SELECT 
        id,
        'home' as type,
        house_type as detail,
        coverage_amount,
        total_premium,
        status,
        created_at,
        policy_start_date,
        policy_end_date
      FROM home_insurance_quotes
      WHERE wallet_address = ?
      ORDER BY created_at DESC
    `, [wallet_address]);

    // Get user's car insurance policies
    const [carPolicies] = await connection.execute(`
      SELECT 
        id,
        'car' as type,
        CONCAT(car_make, ' ', car_model) as detail,
        NULL as coverage_amount,
        NULL as total_premium,
        status,
        created_at,
        policy_start_date,
        policy_end_date
      FROM car_insurance_quotes
      WHERE wallet_address = ?
      ORDER BY created_at DESC
    `, [wallet_address]);

    // Get user's travel insurance policies
    const [travelPolicies] = await connection.execute(`
      SELECT 
        id,
        'travel' as type,
        CONCAT(origin, ' to ', destination) as detail,
        NULL as coverage_amount,
        NULL as total_premium,
        status,
        created_at,
        travel_start_date as policy_start_date,
        travel_end_date as policy_end_date
      FROM travel_insurance_quotes
      WHERE wallet_address = ?
      ORDER BY created_at DESC
    `, [wallet_address]);

    // Get user's claims
    const [claims] = await connection.execute(`
      SELECT 
        claim_id,
        policy_type,
        claim_amount,
        description,
        status,
        created_at,
        incident_date
      FROM insurance_claims
      WHERE wallet_address = ?
      ORDER BY created_at DESC
    `, [wallet_address]);

    // Get user's messages
    const [messages] = await connection.execute(`
      SELECT 
        id,
        subject,
        priority,
        status,
        created_at,
        is_read
      FROM messages
      WHERE wallet_address = ? AND parent_message_id IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `, [wallet_address]);

    const allPolicies = [...homePolicies, ...carPolicies, ...travelPolicies];
    const totalPremium = homePolicies.reduce((sum, policy) => sum + parseFloat(policy.total_premium || 0), 0);

    const userDetails = {
      wallet_address,
      name: generateNameFromWallet(wallet_address),
      email: generateEmailFromWallet(wallet_address),
      status: 'Active',
      joined_date: allPolicies.length > 0 ? allPolicies[allPolicies.length - 1].created_at : null,
      total_policies: allPolicies.length,
      total_premium: totalPremium,
      total_claims: claims.length,
      last_activity: allPolicies.length > 0 ? allPolicies[0].created_at : null,
      policies: allPolicies,
      claims,
      messages
    };

    res.json({
      success: true,
      data: userDetails
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update User Status
const updateUserStatus = async (req, res) => {
  try {
    const { wallet_address } = req.params;
    const { status, notes } = req.body;

    if (!wallet_address || !status) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address and status are required'
      });
    }

    const connection = getConnection();

    // Log admin activity
    await connection.execute(`
      INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.admin.admin_id,
      'update_user_status',
      'user',
      wallet_address,
      JSON.stringify({ status, notes })
    ]);

    res.json({
      success: true,
      message: 'User status updated successfully'
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  generateNameFromWallet,
  generateEmailFromWallet
};