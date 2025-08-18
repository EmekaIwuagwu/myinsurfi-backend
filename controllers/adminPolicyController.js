const { getConnection } = require('../config/database');

// Get All Policy Requests
const getAllPolicyRequests = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'all',
      policy_type = 'all',
      sortBy = 'created_at',
      sortOrder = 'DESC' 
    } = req.query;

    const connection = getConnection();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build status filter
    let statusFilter = '';
    if (status !== 'all') {
      statusFilter = `AND status = '${status}'`;
    }

    let policies = [];

    // Get home insurance policies
    if (policy_type === 'all' || policy_type === 'home') {
      const [homePolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as policy_id,
          id,
          'Home Insurance' as policy_type,
          'home' as type_key,
          wallet_address,
          house_type as item,
          property_owner_name as customer_name,
          house_address as property_item,
          coverage_amount,
          total_premium,
          status,
          created_at as submitted,
          reviewed_by,
          reviewed_at,
          admin_notes
        FROM home_insurance_quotes
        WHERE 1=1 ${statusFilter}
        ORDER BY ${sortBy} ${sortOrder}
      `);
      policies = policies.concat(homePolicies);
    }

    // Get car insurance policies
    if (policy_type === 'all' || policy_type === 'car') {
      const [carPolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as policy_id,
          id,
          'Car Insurance' as policy_type,
          'car' as type_key,
          wallet_address,
          CONCAT(car_make, ' ', car_model) as item,
          NULL as customer_name,
          CONCAT(car_year, ' ', car_make, ' ', car_model) as property_item,
          NULL as coverage_amount,
          0.5 as total_premium,
          status,
          created_at as submitted,
          reviewed_by,
          reviewed_at,
          admin_notes
        FROM car_insurance_quotes
        WHERE 1=1 ${statusFilter}
        ORDER BY ${sortBy} ${sortOrder}
      `);
      policies = policies.concat(carPolicies);
    }

    // Get travel insurance policies
    if (policy_type === 'all' || policy_type === 'travel') {
      const [travelPolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as policy_id,
          id,
          'Travel Insurance' as policy_type,
          'travel' as type_key,
          wallet_address,
          CONCAT(origin, ' to ', destination) as item,
          NULL as customer_name,
          CONCAT(origin, ' to ', destination) as property_item,
          NULL as coverage_amount,
          0.1 as total_premium,
          status,
          created_at as submitted,
          reviewed_by,
          reviewed_at,
          admin_notes
        FROM travel_insurance_quotes
        WHERE 1=1 ${statusFilter}
        ORDER BY ${sortBy} ${sortOrder}
      `);
      policies = policies.concat(travelPolicies);
    }

    // Sort all policies
    policies.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'DESC') {
        return new Date(bValue) - new Date(aValue);
      } else {
        return new Date(aValue) - new Date(bValue);
      }
    });

    // Apply pagination
    const totalPolicies = policies.length;
    const paginatedPolicies = policies.slice(offset, offset + parseInt(limit));

    // Enhance with customer names and format data
    const { generateNameFromWallet } = require('./adminUserController');
    
    const enhancedPolicies = paginatedPolicies.map(policy => ({
      ...policy,
      customer: policy.customer_name || generateNameFromWallet(policy.wallet_address),
      submitted_date: policy.submitted,
      wallet: `${policy.wallet_address.slice(0, 6)}...${policy.wallet_address.slice(-4)}`
    }));

    res.json({
      success: true,
      data: {
        policies: enhancedPolicies,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalPolicies / parseInt(limit)),
          total_policies: totalPolicies,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all policy requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Policy Details
const getPolicyDetails = async (req, res) => {
  try {
    const { policy_id } = req.params;

    if (!policy_id) {
      return res.status(400).json({
        success: false,
        message: 'Policy ID is required'
      });
    }

    const connection = getConnection();

    // Parse policy ID to determine type and ID
    let table, id, policyData;
    
    const numericId = parseInt(policy_id.replace('POL-', ''));

    // Try to find the policy in all tables
    const [homePolicies] = await connection.execute(`
      SELECT 
        h.*,
        'Home Insurance' as policy_type,
        CONCAT('POL-', LPAD(h.id, 3, '0')) as formatted_id,
        a.name as reviewed_by_name
      FROM home_insurance_quotes h
      LEFT JOIN admin_users a ON h.reviewed_by = a.id
      WHERE h.id = ?
    `, [numericId]);

    const [carPolicies] = await connection.execute(`
      SELECT 
        c.*,
        'Car Insurance' as policy_type,
        CONCAT('POL-', LPAD(c.id, 3, '0')) as formatted_id,
        a.name as reviewed_by_name
      FROM car_insurance_quotes c
      LEFT JOIN admin_users a ON c.reviewed_by = a.id
      WHERE c.id = ?
    `, [numericId]);

    const [travelPolicies] = await connection.execute(`
      SELECT 
        t.*,
        'Travel Insurance' as policy_type,
        CONCAT('POL-', LPAD(t.id, 3, '0')) as formatted_id,
        a.name as reviewed_by_name
      FROM travel_insurance_quotes t
      LEFT JOIN admin_users a ON t.reviewed_by = a.id
      WHERE t.id = ?
    `, [numericId]);

    policyData = homePolicies[0] || carPolicies[0] || travelPolicies[0];

    if (!policyData) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    // Enhance with customer info
    const { generateNameFromWallet, generateEmailFromWallet } = require('./adminUserController');
    
    const enhancedPolicy = {
      ...policyData,
      customer_name: policyData.property_owner_name || generateNameFromWallet(policyData.wallet_address),
      customer_email: policyData.property_owner_email || generateEmailFromWallet(policyData.wallet_address),
      formatted_wallet: `${policyData.wallet_address.slice(0, 6)}...${policyData.wallet_address.slice(-4)}`
    };

    res.json({
      success: true,
      data: enhancedPolicy
    });
  } catch (error) {
    console.error('Get policy details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update Policy Status - For this admin system, payment approval = auto-approval
const updatePolicyStatus = async (req, res) => {
  try {
    const { policy_id } = req.params;
    const { status, admin_notes } = req.body;

    if (!policy_id || !status) {
      return res.status(400).json({
        success: false,
        message: 'Policy ID and status are required'
      });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    const connection = getConnection();

    // Parse policy ID to determine ID
    const numericId = parseInt(policy_id.replace('POL-', ''));
    
    // Update all tables (one will match)
    const tables = ['home_insurance_quotes', 'car_insurance_quotes', 'travel_insurance_quotes'];
    let updated = false;
    let walletAddress = null;

    for (const table of tables) {
      const [result] = await connection.execute(`
        UPDATE ${table} 
        SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ?
        WHERE id = ?
      `, [status, req.admin.admin_id, admin_notes, numericId]);

      if (result.affectedRows > 0) {
        updated = true;
        
        // Get wallet address for notification
        const [policyData] = await connection.execute(`
          SELECT wallet_address FROM ${table} WHERE id = ?
        `, [numericId]);
        
        if (policyData.length > 0) {
          walletAddress = policyData[0].wallet_address;
        }
        break;
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    if (walletAddress) {
      // Create notification for user
      await connection.execute(`
        INSERT INTO notifications (wallet_address, type, title, message)
        VALUES (?, ?, ?, ?)
      `, [
        walletAddress,
        'policy_update',
        `Policy ${status}`,
        `Your policy request ${policy_id} has been ${status}.`
      ]);
    }

    // Log admin activity
    await connection.execute(`
      INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.admin.admin_id,
      'update_policy_status',
      'policy',
      policy_id,
      JSON.stringify({ status, admin_notes })
    ]);

    res.json({
      success: true,
      message: `Policy ${status} successfully`
    });
  } catch (error) {
    console.error('Update policy status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Policy Statistics
const getPolicyStatistics = async (req, res) => {
  try {
    const connection = getConnection();

    // Get counts by status for each policy type
    const [homeStats] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM home_insurance_quotes
      GROUP BY status
    `);

    const [carStats] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM car_insurance_quotes
      GROUP BY status
    `);

    const [travelStats] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM travel_insurance_quotes
      GROUP BY status
    `);

    // Aggregate statistics
    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      by_type: {
        home: { total: 0, pending: 0, approved: 0, rejected: 0 },
        car: { total: 0, pending: 0, approved: 0, rejected: 0 },
        travel: { total: 0, pending: 0, approved: 0, rejected: 0 }
      }
    };

    // Process home insurance stats
    homeStats.forEach(stat => {
      stats.total += stat.count;
      stats[stat.status] = (stats[stat.status] || 0) + stat.count;
      stats.by_type.home.total += stat.count;
      stats.by_type.home[stat.status] = stat.count;
    });

    // Process car insurance stats
    carStats.forEach(stat => {
      stats.total += stat.count;
      stats[stat.status] = (stats[stat.status] || 0) + stat.count;
      stats.by_type.car.total += stat.count;
      stats.by_type.car[stat.status] = stat.count;
    });

    // Process travel insurance stats
    travelStats.forEach(stat => {
      stats.total += stat.count;
      stats[stat.status] = (stats[stat.status] || 0) + stat.count;
      stats.by_type.travel.total += stat.count;
      stats.by_type.travel[stat.status] = stat.count;
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get policy statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getAllPolicyRequests,
  getPolicyDetails,
  updatePolicyStatus,
  getPolicyStatistics
};