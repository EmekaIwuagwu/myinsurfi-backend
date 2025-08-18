const { getConnection } = require('../config/database');

// Get User Policy Status
const getUserPolicyStatus = async (req, res) => {
  try {
    const { wallet_address } = req.params;
    const { page = 1, limit = 10, status = 'all', policy_type = 'all' } = req.query;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let policies = [];

    // Get home insurance policies
    if (policy_type === 'all' || policy_type === 'home') {
      const statusFilter = status !== 'all' ? `AND status = '${status}'` : '';
      
      const [homePolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as policy_id,
          id,
          'home' as policy_type,
          house_type as item_description,
          property_owner_name as customer_name,
          house_address,
          coverage_amount,
          total_premium,
          status,
          created_at,
          policy_start_date,
          policy_end_date,
          reviewed_at,
          admin_notes
        FROM home_insurance_quotes
        WHERE wallet_address = ? ${statusFilter}
        ORDER BY created_at DESC
      `, [wallet_address]);
      
      policies = policies.concat(homePolicies);
    }

    // Get car insurance policies
    if (policy_type === 'all' || policy_type === 'car') {
      const statusFilter = status !== 'all' ? `AND status = '${status}'` : '';
      
      const [carPolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as policy_id,
          id,
          'car' as policy_type,
          CONCAT(car_make, ' ', car_model, ' (', car_year, ')') as item_description,
          NULL as customer_name,
          NULL as house_address,
          NULL as coverage_amount,
          0.5 as total_premium,
          status,
          created_at,
          policy_start_date,
          policy_end_date,
          reviewed_at,
          admin_notes
        FROM car_insurance_quotes
        WHERE wallet_address = ? ${statusFilter}
        ORDER BY created_at DESC
      `, [wallet_address]);
      
      policies = policies.concat(carPolicies);
    }

    // Get travel insurance policies
    if (policy_type === 'all' || policy_type === 'travel') {
      const statusFilter = status !== 'all' ? `AND status = '${status}'` : '';
      
      const [travelPolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as policy_id,
          id,
          'travel' as policy_type,
          CONCAT(origin, ' to ', destination) as item_description,
          NULL as customer_name,
          NULL as house_address,
          NULL as coverage_amount,
          0.1 as total_premium,
          status,
          created_at,
          travel_start_date as policy_start_date,
          travel_end_date as policy_end_date,
          reviewed_at,
          admin_notes
        FROM travel_insurance_quotes
        WHERE wallet_address = ? ${statusFilter}
        ORDER BY created_at DESC
      `, [wallet_address]);
      
      policies = policies.concat(travelPolicies);
    }

    // Sort all policies by creation date
    policies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply pagination
    const totalPolicies = policies.length;
    const paginatedPolicies = policies.slice(offset, offset + parseInt(limit));

    // Format policies
    const formattedPolicies = paginatedPolicies.map(policy => ({
      ...policy,
      formatted_premium: policy.total_premium ? parseFloat(policy.total_premium).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      }) : 'N/A',
      formatted_coverage: policy.coverage_amount ? parseFloat(policy.coverage_amount).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      }) : 'N/A',
      status_badge: getStatusBadge(policy.status),
      days_since_application: Math.floor((new Date() - new Date(policy.created_at)) / (1000 * 60 * 60 * 24)),
      is_active: policy.status === 'approved' && new Date(policy.policy_end_date) > new Date(),
      can_claim: policy.status === 'approved'
    }));

    res.json({
      success: true,
      data: {
        policies: formattedPolicies,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalPolicies / parseInt(limit)),
          total_policies: totalPolicies,
          per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user policy status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Specific Policy Details
const getUserPolicyDetails = async (req, res) => {
  try {
    const { policy_id } = req.params;
    const { wallet_address } = req.query;

    if (!policy_id || !wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Policy ID and wallet address are required'
      });
    }

    const connection = getConnection();

    // Parse policy ID to get numeric ID
    const numericId = parseInt(policy_id.replace('POL-', ''));

    // Try to find the policy in all tables
    let policyData = null;
    let policyType = null;

    // Check home insurance
    const [homePolicies] = await connection.execute(`
      SELECT *, 'home' as policy_type FROM home_insurance_quotes 
      WHERE id = ? AND wallet_address = ?
    `, [numericId, wallet_address]);

    if (homePolicies.length > 0) {
      policyData = homePolicies[0];
      policyType = 'home';
    }

    // Check car insurance if not found
    if (!policyData) {
      const [carPolicies] = await connection.execute(`
        SELECT *, 'car' as policy_type FROM car_insurance_quotes 
        WHERE id = ? AND wallet_address = ?
      `, [numericId, wallet_address]);

      if (carPolicies.length > 0) {
        policyData = carPolicies[0];
        policyType = 'car';
      }
    }

    // Check travel insurance if not found
    if (!policyData) {
      const [travelPolicies] = await connection.execute(`
        SELECT *, 'travel' as policy_type FROM travel_insurance_quotes 
        WHERE id = ? AND wallet_address = ?
      `, [numericId, wallet_address]);

      if (travelPolicies.length > 0) {
        policyData = travelPolicies[0];
        policyType = 'travel';
      }
    }

    if (!policyData) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    // Get related claims for this policy
    const [claims] = await connection.execute(`
      SELECT claim_id, claim_amount, status, created_at, description
      FROM insurance_claims 
      WHERE policy_id = ? AND policy_type = ? AND wallet_address = ?
      ORDER BY created_at DESC
    `, [numericId, policyType, wallet_address]);

    // Format policy data based on type
    let formattedPolicy = {
      policy_id: `POL-${String(policyData.id).padStart(3, '0')}`,
      policy_type: policyType,
      status: policyData.status || 'pending',
      created_at: policyData.created_at,
      reviewed_at: policyData.reviewed_at,
      admin_notes: policyData.admin_notes,
      is_active: policyData.status === 'approved' && new Date(policyData.policy_end_date || policyData.travel_end_date) > new Date(),
      can_claim: policyData.status === 'approved',
      claims: claims.map(claim => ({
        ...claim,
        formatted_amount: parseFloat(claim.claim_amount).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        })
      }))
    };

    // Add type-specific details
    if (policyType === 'home') {
      formattedPolicy = {
        ...formattedPolicy,
        house_type: policyData.house_type,
        year_built: policyData.year_built,
        house_address: policyData.house_address,
        property_owner_name: policyData.property_owner_name,
        property_owner_telephone: policyData.property_owner_telephone,
        property_owner_email: policyData.property_owner_email,
        policy_start_date: policyData.policy_start_date,
        policy_end_date: policyData.policy_end_date,
        coverage_duration: policyData.coverage_duration,
        coverage_amount: policyData.coverage_amount,
        total_premium: policyData.total_premium,
        formatted_coverage: parseFloat(policyData.coverage_amount).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        }),
        formatted_premium: parseFloat(policyData.total_premium).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        })
      };
    } else if (policyType === 'car') {
      formattedPolicy = {
        ...formattedPolicy,
        car_make: policyData.car_make,
        car_model: policyData.car_model,
        car_year: policyData.car_year,
        mileage: policyData.mileage,
        policy_start_date: policyData.policy_start_date,
        policy_end_date: policyData.policy_end_date,
        coverage_duration: policyData.coverage_duration,
        vehicle_description: `${policyData.car_year} ${policyData.car_make} ${policyData.car_model}`
      };
    } else if (policyType === 'travel') {
      formattedPolicy = {
        ...formattedPolicy,
        origin: policyData.origin,
        departure: policyData.departure,
        destination: policyData.destination,
        passport_number: policyData.passport_number,
        passport_country: policyData.passport_country,
        travel_start_date: policyData.travel_start_date,
        travel_end_date: policyData.travel_end_date,
        coverage_duration: policyData.coverage_duration,
        trip_description: `${policyData.origin} to ${policyData.destination}`
      };
    }

    res.json({
      success: true,
      data: formattedPolicy
    });
  } catch (error) {
    console.error('Get user policy details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Request Policy Modification
const requestPolicyModification = async (req, res) => {
  try {
    const { policy_id } = req.params;
    const { wallet_address, modification_type, details, reason } = req.body;

    if (!policy_id || !wallet_address || !modification_type || !details) {
      return res.status(400).json({
        success: false,
        message: 'Policy ID, wallet address, modification type, and details are required'
      });
    }

    const connection = getConnection();

    // Create modification request (this would require a new table)
    // For now, we'll create a message to admin
    const subject = `Policy Modification Request - ${policy_id}`;
    const message = `User requests ${modification_type} for policy ${policy_id}.\n\nDetails: ${details}\n\nReason: ${reason || 'Not specified'}`;

    const [result] = await connection.execute(`
      INSERT INTO messages 
      (wallet_address, sender_type, subject, message, priority) 
      VALUES (?, 'user', ?, ?, 'medium')
    `, [wallet_address, subject, message]);

    // Create notification for user
    await connection.execute(`
      INSERT INTO notifications (wallet_address, type, title, message)
      VALUES (?, ?, ?, ?)
    `, [
      wallet_address,
      'policy_update',
      'Modification Request Submitted',
      `Your modification request for policy ${policy_id} has been submitted and is being reviewed.`
    ]);

    res.status(201).json({
      success: true,
      message: 'Policy modification request submitted successfully',
      data: { 
        request_id: result.insertId,
        status: 'pending_review'
      }
    });
  } catch (error) {
    console.error('Request policy modification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Policy Summary
const getPolicySummary = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    // Get summary of all policies
    const [homeSummary] = await connection.execute(`
      SELECT 
        COUNT(*) as total_policies,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as active_policies,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_policies,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_policies,
        COALESCE(SUM(total_premium), 0) as total_premium_paid,
        COALESCE(SUM(coverage_amount), 0) as total_coverage
      FROM home_insurance_quotes
      WHERE wallet_address = ?
    `, [wallet_address]);

    const [carSummary] = await connection.execute(`
      SELECT 
        COUNT(*) as total_policies,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as active_policies,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_policies,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_policies
      FROM car_insurance_quotes
      WHERE wallet_address = ?
    `, [wallet_address]);

    const [travelSummary] = await connection.execute(`
      SELECT 
        COUNT(*) as total_policies,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as active_policies,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_policies,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_policies
      FROM travel_insurance_quotes
      WHERE wallet_address = ?
    `, [wallet_address]);

    const summary = {
      total_policies: homeSummary[0].total_policies + carSummary[0].total_policies + travelSummary[0].total_policies,
      active_policies: homeSummary[0].active_policies + carSummary[0].active_policies + travelSummary[0].active_policies,
      pending_policies: homeSummary[0].pending_policies + carSummary[0].pending_policies + travelSummary[0].pending_policies,
      rejected_policies: homeSummary[0].rejected_policies + carSummary[0].rejected_policies + travelSummary[0].rejected_policies,
      total_premium_paid: parseFloat(homeSummary[0].total_premium_paid || 0),
      total_coverage: parseFloat(homeSummary[0].total_coverage || 0),
      by_type: {
        home: homeSummary[0],
        car: carSummary[0],
        travel: travelSummary[0]
      }
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get policy summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Helper function for status badges
const getStatusBadge = (status) => {
  const badges = {
    'pending': { text: 'Pending Review', color: 'yellow', icon: '⏳' },
    'approved': { text: 'Active', color: 'green', icon: '✅' },
    'rejected': { text: 'Rejected', color: 'red', icon: '❌' }
  };
  return badges[status] || { text: 'Unknown', color: 'gray', icon: '❓' };
};

module.exports = {
  getUserPolicyStatus,
  getUserPolicyDetails,
  requestPolicyModification,
  getPolicySummary
};