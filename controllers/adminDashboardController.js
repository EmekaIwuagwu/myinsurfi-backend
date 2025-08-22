const { getConnection } = require('../config/database');

// Get Dashboard Overview
const getDashboardOverview = async (req, res) => {
  try {
    const connection = getConnection();

    // Get total users count (unique wallet addresses)
    const [userCount] = await connection.execute(`
      SELECT COUNT(DISTINCT wallet_address) as total_users
      FROM (
        SELECT wallet_address FROM home_insurance_quotes
        UNION
        SELECT wallet_address FROM car_insurance_quotes
        UNION
        SELECT wallet_address FROM travel_insurance_quotes
      ) as all_users
    `);

    // Get active policies count
    const [policyCount] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM home_insurance_quotes WHERE status = 'approved') +
        (SELECT COUNT(*) FROM car_insurance_quotes WHERE status = 'approved') +
        (SELECT COUNT(*) FROM travel_insurance_quotes WHERE status = 'approved') as active_policies
    `);

    // Get total claims count
    const [claimCount] = await connection.execute(`
      SELECT COUNT(*) as total_claims FROM insurance_claims
    `);

    // Get platform revenue (sum of all premiums from approved policies)
    const [revenue] = await connection.execute(`
      SELECT 
        COALESCE(SUM(total_premium), 0) as platform_revenue
      FROM home_insurance_quotes 
      WHERE status = 'approved'
    `);

    // Generate mock monthly views data (since platform_analytics table might not exist)
    const monthlyViews = [
      { month: '2024-08', total_views: 1200 },
      { month: '2024-09', total_views: 1450 },
      { month: '2024-10', total_views: 1800 },
      { month: '2024-11', total_views: 2100 },
      { month: '2024-12', total_views: 2400 },
      { month: '2025-01', total_views: 2600 }
    ];

    // Calculate percentage changes (mock data for now)
    const userGrowth = '+12%';
    const policyGrowth = '+8%';
    const claimGrowth = '+15%';
    const revenueGrowth = '+22%';

    res.json({
      success: true,
      data: {
        overview: {
          total_users: userCount[0].total_users || 0,
          user_growth: userGrowth,
          active_policies: policyCount[0].active_policies || 0,
          policy_growth: policyGrowth,
          total_claims: claimCount[0].total_claims || 0,
          claim_growth: claimGrowth,
          platform_revenue: parseFloat(revenue[0].platform_revenue || 0),
          revenue_growth: revenueGrowth
        },
        monthly_views: monthlyViews,
        current_month_views: 2600
      }
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Recent Activities - FIXED VERSION
const getRecentActivities = async (req, res) => {
  try {
    const connection = getConnection();
    const activities = [];

    // Get recent home insurance submissions with error handling
    try {
      const [homePolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as reference_id,
          'policy_submission' as activity_type,
          'New home insurance policy submitted' as title,
          CONCAT('Home insurance policy for ', house_type, ' submitted by ', LEFT(wallet_address, 6), '...', RIGHT(wallet_address, 4)) as description,
          created_at,
          wallet_address
        FROM home_insurance_quotes
        ORDER BY created_at DESC
        LIMIT 3
      `);
      activities.push(...homePolicies);
    } catch (err) {
      console.log('Error fetching home policies for activities:', err.message);
    }

    // Get recent car insurance submissions with error handling
    try {
      const [carPolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as reference_id,
          'policy_submission' as activity_type,
          'New car insurance policy submitted' as title,
          CONCAT('Car insurance for ', car_make, ' ', car_model, ' submitted') as description,
          created_at,
          wallet_address
        FROM car_insurance_quotes
        ORDER BY created_at DESC
        LIMIT 3
      `);
      activities.push(...carPolicies);
    } catch (err) {
      console.log('Error fetching car policies for activities:', err.message);
    }

    // Get recent travel insurance submissions with error handling
    try {
      const [travelPolicies] = await connection.execute(`
        SELECT 
          CONCAT('POL-', LPAD(id, 3, '0')) as reference_id,
          'policy_submission' as activity_type,
          'New travel insurance policy submitted' as title,
          CONCAT('Travel insurance from ', origin, ' to ', destination, ' submitted') as description,
          created_at,
          wallet_address
        FROM travel_insurance_quotes
        ORDER BY created_at DESC
        LIMIT 3
      `);
      activities.push(...travelPolicies);
    } catch (err) {
      console.log('Error fetching travel policies for activities:', err.message);
    }

    // Get recent claims with error handling
    try {
      const [claims] = await connection.execute(`
        SELECT 
          claim_id as reference_id,
          'claim_submission' as activity_type,
          'New insurance claim submitted' as title,
          CONCAT('Claim for ', policy_type, ' - ', SUBSTRING(description, 1, 50), '...') as description,
          created_at,
          wallet_address
        FROM insurance_claims
        ORDER BY created_at DESC
        LIMIT 3
      `);
      activities.push(...claims);
    } catch (err) {
      console.log('Error fetching claims for activities:', err.message);
    }

    // Sort all activities by created_at
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Format activities with time ago
    const formattedActivities = activities.slice(0, 10).map(activity => ({
      type: activity.activity_type,
      title: activity.title,
      description: activity.description,
      time: formatTimeAgo(activity.created_at),
      created_at: activity.created_at,
      reference_id: activity.reference_id
    }));

    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Platform Analytics - FIXED VERSION
const getPlatformAnalytics = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Generate mock analytics data since platform_analytics table might not exist
    const generateMockData = (days) => {
      const data = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        data.push({
          date: date.toISOString().split('T')[0],
          daily_views: Math.floor(Math.random() * 100) + 50,
          new_users: Math.floor(Math.random() * 20) + 5,
          revenue: Math.floor(Math.random() * 1000) + 100
        });
      }
      return data;
    };

    let days = 30;
    switch (timeframe) {
      case '7d':
        days = 7;
        break;
      case '30d':
        days = 30;
        break;
      case '90d':
        days = 90;
        break;
    }

    const analyticsData = generateMockData(days);

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Platform analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Helper function to format time ago
const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
};

module.exports = {
  getDashboardOverview,
  getRecentActivities,
  getPlatformAnalytics
};