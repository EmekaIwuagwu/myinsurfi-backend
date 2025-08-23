const { getConnection } = require('../config/database');

// Helper functions
const usdToEth = (usd) => {
  const ethPrice = 2150; // Mock ETH price
  return (usd / ethPrice).toFixed(1);
};

// Get Revenue Overview
const getRevenueOverview = async (req, res) => {
  try {
    const connection = getConnection();

    // Get total revenue from approved home insurance
    const [revenueData] = await connection.execute(`
      SELECT 
        COALESCE(SUM(total_premium), 0) as total_revenue,
        COUNT(*) as total_policies
      FROM home_insurance_quotes 
      WHERE status = 'approved'
    `);

    // Get monthly revenue
    const [monthlyData] = await connection.execute(`
      SELECT 
        COALESCE(SUM(total_premium), 0) as monthly_revenue
      FROM home_insurance_quotes 
      WHERE status = 'approved' 
        AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE())
    `);

    // Get car and travel counts for estimation
    const [carCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM car_insurance_quotes WHERE status = 'approved'
    `);

    const [travelCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM travel_insurance_quotes WHERE status = 'approved'
    `);

    const totalRevenueUsd = parseFloat(revenueData[0]?.total_revenue || 0) + 
                           (carCount[0]?.count || 0) * 1200 + 
                           (travelCount[0]?.count || 0) * 300;
    
    const monthlyRevenueUsd = parseFloat(monthlyData[0]?.monthly_revenue || 0);
    
    // Calculate fees (5% platform fee, 1% processing fee)
    const platformFeesUsd = totalRevenueUsd * 0.05;
    const transactionFeesUsd = totalRevenueUsd * 0.01;

    res.json({
      success: true,
      data: {
        totalRevenue: {
          eth: usdToEth(totalRevenueUsd),
          usd: parseInt(totalRevenueUsd).toLocaleString(),
          change: '+18.2%'
        },
        monthlyRevenue: {
          eth: usdToEth(monthlyRevenueUsd),
          usd: parseInt(monthlyRevenueUsd).toLocaleString(),
          change: '+13.5%'
        },
        transactionFees: {
          eth: usdToEth(transactionFeesUsd),
          usd: parseInt(transactionFeesUsd).toLocaleString(),
          change: '+2.3%'
        },
        platformFees: {
          eth: usdToEth(platformFeesUsd),
          usd: parseInt(platformFeesUsd).toLocaleString(),
          change: '+25.8%'
        }
      }
    });

  } catch (error) {
    console.error('Revenue overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Revenue Trends
const getRevenueTrends = async (req, res) => {
  try {
    const connection = getConnection();

    const [trendsData] = await connection.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COALESCE(SUM(total_premium), 0) as revenue
      FROM home_insurance_quotes 
      WHERE status = 'approved' 
        AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const trendData = [];

    for (let i = 0; i < 6; i++) {
      const existingData = trendsData[i];
      const revenue = existingData ? parseFloat(existingData.revenue) : Math.random() * 200000 + 100000;
      const fees = revenue * 0.05;

      trendData.push({
        month: months[i],
        revenue: parseFloat(usdToEth(revenue)),
        fees: parseFloat(usdToEth(fees))
      });
    }

    res.json({
      success: true,
      data: trendData
    });

  } catch (error) {
    console.error('Revenue trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Revenue by Category
const getRevenueByCategory = async (req, res) => {
  try {
    const connection = getConnection();

    const [homeRevenue] = await connection.execute(`
      SELECT COALESCE(SUM(total_premium), 0) as revenue FROM home_insurance_quotes WHERE status = 'approved'
    `);

    const [carCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM car_insurance_quotes WHERE status = 'approved'
    `);

    const [travelCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM travel_insurance_quotes WHERE status = 'approved'
    `);

    const homeRevenueUsd = parseFloat(homeRevenue[0]?.revenue || 0);
    const carRevenueUsd = (carCount[0]?.count || 0) * 1200;
    const travelRevenueUsd = (travelCount[0]?.count || 0) * 300;
    const totalRevenue = homeRevenueUsd + carRevenueUsd + travelRevenueUsd;

    const categories = [
      {
        name: 'Home Insurance',
        amount: usdToEth(homeRevenueUsd),
        percentage: totalRevenue > 0 ? ((homeRevenueUsd / totalRevenue) * 100).toFixed(1) : '0'
      },
      {
        name: 'Car Insurance', 
        amount: usdToEth(carRevenueUsd),
        percentage: totalRevenue > 0 ? ((carRevenueUsd / totalRevenue) * 100).toFixed(1) : '0'
      },
      {
        name: 'Travel Insurance',
        amount: usdToEth(travelRevenueUsd),
        percentage: totalRevenue > 0 ? ((travelRevenueUsd / totalRevenue) * 100).toFixed(1) : '0'
      },
      {
        name: 'Claims Processing',
        amount: '68.7',
        percentage: '5.5'
      }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Revenue by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Top Earning Policies
const getTopEarningPolicies = async (req, res) => {
  try {
    const topPolicies = [
      {
        name: 'Premium Home Insurance',
        amount: '45.2',
        change: '+19%',
        changeType: 'increase'
      },
      {
        name: 'Luxury Car Insurance', 
        amount: '38.7',
        change: '-27%',
        changeType: 'decrease'
      },
      {
        name: 'International Travel',
        amount: '32.1', 
        change: '+8%',
        changeType: 'increase'
      },
      {
        name: 'Business Insurance',
        amount: '28.9',
        change: '+35%', 
        changeType: 'increase'
      },
      {
        name: 'Health Insurance',
        amount: '22.4',
        change: '+12%',
        changeType: 'increase'
      }
    ];

    res.json({
      success: true,
      data: topPolicies
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Transaction Analytics
const getTransactionAnalytics = async (req, res) => {
  try {
    const connection = getConnection();

    const [successfulTransactions] = await connection.execute(`
      SELECT COUNT(*) as count FROM home_insurance_quotes WHERE status = 'approved'
    `);

    const [failedTransactions] = await connection.execute(`
      SELECT COUNT(*) as count FROM home_insurance_quotes WHERE status = 'rejected'
    `);

    const successfulCount = parseInt(successfulTransactions[0]?.count || 0);
    const failedCount = parseInt(failedTransactions[0]?.count || 0);
    const totalTransactions = successfulCount + failedCount;
    const successRate = totalTransactions > 0 ? ((successfulCount / totalTransactions) * 100).toFixed(1) : '100.0';

    res.json({
      success: true,
      data: {
        successfulPayments: successfulCount,
        failedTransactions: failedCount,
        averageTransaction: '2.3 ETH',
        processingFees: '0.15 ETH',
        successRate: `${successRate}%`
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getRevenueOverview,
  getRevenueTrends,
  getRevenueByCategory,
  getTopEarningPolicies,
  getTransactionAnalytics
};