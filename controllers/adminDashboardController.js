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

    // Get monthly views for chart
    const [monthlyViews] = await connection.execute(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') as month,
        SUM(metric_value) as total_views
      FROM platform_analytics 
      WHERE metric_type = 'daily_views' 
        AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `);

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
        current_month_views: 2600 // This would be calculated from current month data
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

// Get Recent Activities
const getRecentActivities = async (req, res) => {
  try {
    const connection = getConnection();

    // Get recent user registrations (new wallet addresses)
    const [newUsers] = await connection.execute(`
      SELECT 
        wallet_address,
        created_at,
        'New user registration' as activity_type,
        CONCAT('User ', LEFT(wallet_address, 6), '...', RIGHT(wallet_address, 4), ' joined as a buyer') as description
      FROM (
        SELECT wallet_address, created_at FROM home_insurance_quotes
        UNION
        SELECT wallet_address, created_at FROM car_insurance_quotes
        UNION
        SELECT wallet_address, created_at FROM travel_insurance_quotes
      ) as all_users
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get recent policy listings
    const [newPolicies] = await connection.execute(`
      SELECT 
        'policy_listed' as activity_type,
        'Policy listed' as title,
        CONCAT('New ', house_type, ' insurance policy added to marketplace') as description,
        created_at,
        '15 minutes ago' as time_ago
      FROM home_insurance_quotes
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY created_at DESC
      LIMIT 3
    `);

    // Get recent transactions
    const [transactions] = await connection.execute(`
      SELECT 
        'transaction_completed' as activity_type,
        'Transaction completed' as title,
        CONCAT('User purchased insurance for ', FORMAT(total_premium, 2), ' ETH') as description,
        created_at,
        '1 hour ago' as time_ago
      FROM home_insurance_quotes
      WHERE status = 'approved' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY created_at DESC
      LIMIT 2
    `);

    // Get recent claims
    const [claims] = await connection.execute(`
      SELECT 
        'claim_submitted' as activity_type,
        'Claim submitted' as title,
        CONCAT('Insurance claim for ', description) as description,
        created_at,
        '2 hours ago' as time_ago
      FROM insurance_claims
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY created_at DESC
      LIMIT 2
    `);

    // Get recent policy approvals
    const [approvals] = await connection.execute(`
      SELECT 
        'policy_approved' as activity_type,
        'Policy approved' as title,
        CONCAT('Car insurance policy for ', LEFT(wallet_address, 6), '...', RIGHT(wallet_address, 4)) as description,
        updated_at as created_at,
        '3 hours ago' as time_ago
      FROM car_insurance_quotes
      WHERE status = 'approved' AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY updated_at DESC
      LIMIT 2
    `);

    // Combine all activities
    const activities = [
      ...newUsers.map(item => ({
        type: 'new_user',
        title: 'New user registration',
        description: item.description,
        time: '2 minutes ago',
        created_at: item.created_at
      })),
      ...newPolicies.map(item => ({
        type: 'policy_listed',
        title: item.title,
        description: item.description,
        time: item.time_ago,
        created_at: item.created_at
      })),
      ...transactions.map(item => ({
        type: 'transaction_completed',
        title: item.title,
        description: item.description,
        time: item.time_ago,
        created_at: item.created_at
      })),
      ...claims.map(item => ({
        type: 'claim_submitted',
        title: item.title,
        description: item.description,
        time: item.time_ago,
        created_at: item.created_at
      })),
      ...approvals.map(item => ({
        type: 'policy_approved',
        title: item.title,
        description: item.description,
        time: item.time_ago,
        created_at: item.created_at
      }))
    ];

    // Sort by created_at and limit to latest 10
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: activities.slice(0, 10)
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

// Get Platform Analytics
const getPlatformAnalytics = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const connection = getConnection();

    let dateFilter = '';
    switch (timeframe) {
      case '7d':
        dateFilter = 'AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)';
        break;
      case '30d':
        dateFilter = 'AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)';
        break;
      case '90d':
        dateFilter = 'AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)';
        break;
      default:
        dateFilter = 'AND date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)';
    }

    const [analytics] = await connection.execute(`
      SELECT 
        date,
        metric_type,
        metric_value
      FROM platform_analytics 
      WHERE metric_type IN ('daily_views', 'new_users', 'revenue')
      ${dateFilter}
      ORDER BY date ASC
    `);

    // Process data for chart
    const chartData = {};
    analytics.forEach(item => {
      if (!chartData[item.date]) {
        chartData[item.date] = {};
      }
      chartData[item.date][item.metric_type] = item.metric_value;
    });

    const formattedData = Object.keys(chartData).map(date => ({
      date,
      ...chartData[date]
    }));

    res.json({
      success: true,
      data: formattedData
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

module.exports = {
  getDashboardOverview,
  getRecentActivities,
  getPlatformAnalytics
};