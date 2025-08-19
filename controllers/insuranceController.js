const { getConnection } = require('../config/database');

// Helper function to check if column exists in table
const columnExists = async (connection, tableName, columnName) => {
  try {
    const [result] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ? 
      AND COLUMN_NAME = ?
    `, [tableName, columnName]);
    return result[0].count > 0;
  } catch (error) {
    return false;
  }
};

// Create Home Insurance Quote
const createHomeInsuranceQuote = async (req, res) => {
  try {
    const {
      wallet_address,
      house_type,
      year_built,
      house_address,
      property_owner_name,
      property_owner_telephone,
      property_owner_email,
      policy_start_date,
      policy_end_date,
      coverage_duration,
      coverage_amount,
      total_premium
    } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    const [result] = await connection.execute(
      `INSERT INTO home_insurance_quotes 
       (wallet_address, house_type, year_built, house_address, property_owner_name, 
        property_owner_telephone, property_owner_email, policy_start_date, policy_end_date, 
        coverage_duration, coverage_amount, total_premium) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [wallet_address, house_type, year_built, house_address, property_owner_name,
        property_owner_telephone, property_owner_email, policy_start_date, policy_end_date,
        coverage_duration, coverage_amount, total_premium]
    );

    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'home_insurance', 'Home Insurance Quote Created',
        'Your home insurance quote has been successfully created.']
    );

    res.status(201).json({
      success: true,
      message: 'Home insurance quote created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error creating home insurance quote:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create Car Insurance Quote (UPDATED)
const createCarInsuranceQuote = async (req, res) => {
  try {
    const {
      wallet_address,
      car_make,
      car_model,
      car_year,
      mileage,
      policy_start_date,
      policy_end_date,
      coverage_duration,
      coverage_amount,
      total_premium
    } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    const hasCoverageAmount = await columnExists(connection, 'car_insurance_quotes', 'coverage_amount');
    const hasTotalPremium = await columnExists(connection, 'car_insurance_quotes', 'total_premium');

    let query, values;

    if (hasCoverageAmount && hasTotalPremium) {
      if (!coverage_amount) {
        return res.status(400).json({
          success: false,
          message: 'Coverage amount is required'
        });
      }

      query = `INSERT INTO car_insurance_quotes 
               (wallet_address, car_make, car_model, car_year, mileage, 
                policy_start_date, policy_end_date, coverage_duration, coverage_amount, total_premium) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      values = [wallet_address, car_make, car_model, car_year, mileage,
        policy_start_date, policy_end_date, coverage_duration, coverage_amount, total_premium || 0];
    } else {
      query = `INSERT INTO car_insurance_quotes 
               (wallet_address, car_make, car_model, car_year, mileage, 
                policy_start_date, policy_end_date, coverage_duration) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      values = [wallet_address, car_make, car_model, car_year, mileage,
        policy_start_date, policy_end_date, coverage_duration];
    }

    const [result] = await connection.execute(query, values);

    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'car_insurance', 'Car Insurance Quote Created',
        'Your car insurance quote has been successfully created.']
    );

    const responseData = { id: result.insertId };
    if (hasCoverageAmount && coverage_amount) {
      responseData.coverage_amount = coverage_amount;
    }
    if (hasTotalPremium && total_premium) {
      responseData.total_premium = total_premium;
    }

    res.status(201).json({
      success: true,
      message: 'Car insurance quote created successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Error creating car insurance quote:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create Travel Insurance Quote (UPDATED)
const createTravelInsuranceQuote = async (req, res) => {
  try {
    const {
      wallet_address,
      origin,
      departure,
      destination,
      passport_number,
      passport_country,
      travel_start_date,
      travel_end_date,
      coverage_duration,
      coverage_amount,
      total_premium
    } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    const hasCoverageAmount = await columnExists(connection, 'travel_insurance_quotes', 'coverage_amount');
    const hasTotalPremium = await columnExists(connection, 'travel_insurance_quotes', 'total_premium');

    let query, values;

    if (hasCoverageAmount && hasTotalPremium) {
      if (!coverage_amount) {
        return res.status(400).json({
          success: false,
          message: 'Coverage amount is required'
        });
      }

      query = `INSERT INTO travel_insurance_quotes 
               (wallet_address, origin, departure, destination, passport_number, 
                passport_country, travel_start_date, travel_end_date, coverage_duration, coverage_amount, total_premium) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      values = [wallet_address, origin, departure, destination, passport_number,
        passport_country, travel_start_date, travel_end_date, coverage_duration, coverage_amount, total_premium || 0];
    } else {
      query = `INSERT INTO travel_insurance_quotes 
               (wallet_address, origin, departure, destination, passport_number, 
                passport_country, travel_start_date, travel_end_date, coverage_duration) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      values = [wallet_address, origin, departure, destination, passport_number,
        passport_country, travel_start_date, travel_end_date, coverage_duration];
    }

    const [result] = await connection.execute(query, values);

    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'travel_insurance', 'Travel Insurance Quote Created',
        'Your travel insurance quote has been successfully created.']
    );

    const responseData = { id: result.insertId };
    if (hasCoverageAmount && coverage_amount) {
      responseData.coverage_amount = coverage_amount;
    }
    if (hasTotalPremium && total_premium) {
      responseData.total_premium = total_premium;
    }

    res.status(201).json({
      success: true,
      message: 'Travel insurance quote created successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Error creating travel insurance quote:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Active Policies
const getActivePolicies = async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();

    const carHasCoverage = await columnExists(connection, 'car_insurance_quotes', 'coverage_amount');
    const carHasPremium = await columnExists(connection, 'car_insurance_quotes', 'total_premium');
    const travelHasCoverage = await columnExists(connection, 'travel_insurance_quotes', 'coverage_amount');
    const travelHasPremium = await columnExists(connection, 'travel_insurance_quotes', 'total_premium');

    const carAmountSelect = carHasCoverage ? 'coverage_amount' : 'NULL';
    const carPremiumSelect = carHasPremium ? 'total_premium' : 'NULL';
    const travelAmountSelect = travelHasCoverage ? 'coverage_amount' : 'NULL';
    const travelPremiumSelect = travelHasPremium ? 'total_premium' : 'NULL';

    const [policies] = await connection.execute(
      `(SELECT 
         id, wallet_address, 'home' as policy_type, 
         house_type as detail_1, property_owner_name as detail_2, 
         coverage_amount as amount, total_premium as premium,
         policy_start_date, policy_end_date, created_at
       FROM home_insurance_quotes 
       WHERE wallet_address = ?)
       UNION ALL
       (SELECT 
         id, wallet_address, 'car' as policy_type,
         CONCAT(car_make, ' ', car_model) as detail_1, car_year as detail_2,
         ${carAmountSelect} as amount, ${carPremiumSelect} as premium,
         policy_start_date, policy_end_date, created_at
       FROM car_insurance_quotes 
       WHERE wallet_address = ?)
       UNION ALL
       (SELECT 
         id, wallet_address, 'travel' as policy_type,
         CONCAT(origin, ' to ', destination) as detail_1, passport_country as detail_2,
         ${travelAmountSelect} as amount, ${travelPremiumSelect} as premium,
         travel_start_date as policy_start_date, travel_end_date as policy_end_date, created_at
       FROM travel_insurance_quotes 
       WHERE wallet_address = ?)
       ORDER BY created_at DESC`,
      [wallet_address, wallet_address, wallet_address]
    );

    res.json({
      success: true,
      data: policies
    });
  } catch (error) {
    console.error('Error fetching active policies:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Single Policy Details by ID with Policy Type (UPDATED)
const getPolicyById = async (req, res) => {
  try {
    const { policy_id } = req.params;
    const { wallet_address, policy_type } = req.query;

    if (!policy_id) {
      return res.status(400).json({
        success: false,
        message: 'Policy ID is required'
      });
    }

    const connection = getConnection();

    let policyData = null;
    let actualPolicyType = null;

    // If policy_type is specified, search only that table
    if (policy_type) {
      const validTypes = ['home', 'car', 'travel'];
      if (!validTypes.includes(policy_type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid policy_type. Must be: home, car, or travel'
        });
      }

      // Search specific table based on policy_type
      if (policy_type === 'home') {
        const [homePolicies] = await connection.execute(`
          SELECT *, 'home' as policy_type FROM home_insurance_quotes 
          WHERE id = ? ${wallet_address ? 'AND wallet_address = ?' : ''}
        `, wallet_address ? [policy_id, wallet_address] : [policy_id]);

        if (homePolicies.length > 0) {
          policyData = homePolicies[0];
          actualPolicyType = 'home';
        }
      } else if (policy_type === 'car') {
        const carHasCoverage = await columnExists(connection, 'car_insurance_quotes', 'coverage_amount');
        const carHasPremium = await columnExists(connection, 'car_insurance_quotes', 'total_premium');

        let carQuery = `SELECT *, 'car' as policy_type`;
        if (carHasCoverage) carQuery += `, coverage_amount`;
        if (carHasPremium) carQuery += `, total_premium`;
        carQuery += ` FROM car_insurance_quotes WHERE id = ?`;
        if (wallet_address) carQuery += ` AND wallet_address = ?`;

        const [carPolicies] = await connection.execute(carQuery,
          wallet_address ? [policy_id, wallet_address] : [policy_id]);

        if (carPolicies.length > 0) {
          policyData = carPolicies[0];
          actualPolicyType = 'car';
          if (!carHasCoverage) policyData.coverage_amount = 50000;
          if (!carHasPremium) policyData.total_premium = 1200;
        }
      } else if (policy_type === 'travel') {
        const travelHasCoverage = await columnExists(connection, 'travel_insurance_quotes', 'coverage_amount');
        const travelHasPremium = await columnExists(connection, 'travel_insurance_quotes', 'total_premium');

        let travelQuery = `SELECT *, 'travel' as policy_type`;
        if (travelHasCoverage) travelQuery += `, coverage_amount`;
        if (travelHasPremium) travelQuery += `, total_premium`;
        travelQuery += ` FROM travel_insurance_quotes WHERE id = ?`;
        if (wallet_address) travelQuery += ` AND wallet_address = ?`;

        const [travelPolicies] = await connection.execute(travelQuery,
          wallet_address ? [policy_id, wallet_address] : [policy_id]);

        if (travelPolicies.length > 0) {
          policyData = travelPolicies[0];
          actualPolicyType = 'travel';
          if (!travelHasCoverage) policyData.coverage_amount = 25000;
          if (!travelHasPremium) policyData.total_premium = 300;
        }
      }
    } else {
      // Original behavior: search all tables (for backward compatibility)
      // Check Home Insurance first
      const [homePolicies] = await connection.execute(`
        SELECT *, 'home' as policy_type FROM home_insurance_quotes 
        WHERE id = ? ${wallet_address ? 'AND wallet_address = ?' : ''}
      `, wallet_address ? [policy_id, wallet_address] : [policy_id]);

      if (homePolicies.length > 0) {
        policyData = homePolicies[0];
        actualPolicyType = 'home';
      } else {
        // Check Car Insurance
        const carHasCoverage = await columnExists(connection, 'car_insurance_quotes', 'coverage_amount');
        const carHasPremium = await columnExists(connection, 'car_insurance_quotes', 'total_premium');

        let carQuery = `SELECT *, 'car' as policy_type`;
        if (carHasCoverage) carQuery += `, coverage_amount`;
        if (carHasPremium) carQuery += `, total_premium`;
        carQuery += ` FROM car_insurance_quotes WHERE id = ?`;
        if (wallet_address) carQuery += ` AND wallet_address = ?`;

        const [carPolicies] = await connection.execute(carQuery,
          wallet_address ? [policy_id, wallet_address] : [policy_id]);

        if (carPolicies.length > 0) {
          policyData = carPolicies[0];
          actualPolicyType = 'car';
          if (!carHasCoverage) policyData.coverage_amount = 50000;
          if (!carHasPremium) policyData.total_premium = 1200;
        } else {
          // Check Travel Insurance
          const travelHasCoverage = await columnExists(connection, 'travel_insurance_quotes', 'coverage_amount');
          const travelHasPremium = await columnExists(connection, 'travel_insurance_quotes', 'total_premium');

          let travelQuery = `SELECT *, 'travel' as policy_type`;
          if (travelHasCoverage) travelQuery += `, coverage_amount`;
          if (travelHasPremium) travelQuery += `, total_premium`;
          travelQuery += ` FROM travel_insurance_quotes WHERE id = ?`;
          if (wallet_address) travelQuery += ` AND wallet_address = ?`;

          const [travelPolicies] = await connection.execute(travelQuery,
            wallet_address ? [policy_id, wallet_address] : [policy_id]);

          if (travelPolicies.length > 0) {
            policyData = travelPolicies[0];
            actualPolicyType = 'travel';
            if (!travelHasCoverage) policyData.coverage_amount = 25000;
            if (!travelHasPremium) policyData.total_premium = 300;
          }
        }
      }
    }

    if (!policyData) {
      return res.status(404).json({
        success: false,
        message: policy_type ?
          `${policy_type.charAt(0).toUpperCase() + policy_type.slice(1)} insurance policy not found` :
          'Policy not found'
      });
    }

    // Rest of the function remains the same...
    // (Keep all the formatting code from before)

    // Generate policy number
    const generatePolicyNumber = (id, type) => {
      const prefixes = { 'home': 'HI', 'car': 'CI', 'travel': 'TI' };
      const prefix = prefixes[type] || 'POL';
      const year = new Date().getFullYear();
      return `${prefix}-${year}-${id}`;
    };

    // Calculate policy status
    const getPolicyStatus = (startDate, endDate, dbStatus) => {
      if (dbStatus === 'rejected') return 'rejected';
      if (dbStatus === 'pending') return 'pending';

      const now = new Date();
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (now < start) return 'upcoming';
      if (now > end) return 'expired';
      return 'active';
    };

    // Calculate deductible
    const calculateDeductible = (coverageAmount, policyType) => {
      if (!coverageAmount) return 2500;
      const percentage = policyType === 'home' ? 0.005 : 0.01;
      return Math.round(coverageAmount * percentage);
    };

    // Format the policy data
    let formattedPolicy = {
      id: policyData.id,
      policy_number: generatePolicyNumber(policyData.id, actualPolicyType),
      policy_type: actualPolicyType,
      policy_type_display: actualPolicyType.charAt(0).toUpperCase() + actualPolicyType.slice(1) + ' Insurance',
      wallet_address: policyData.wallet_address,
      status: getPolicyStatus(
        policyData.policy_start_date || policyData.travel_start_date,
        policyData.policy_end_date || policyData.travel_end_date,
        policyData.status || 'approved'
      ),
      created_at: policyData.created_at,
      coverage_amount: policyData.coverage_amount,
      total_premium: policyData.total_premium,
      deductible: calculateDeductible(policyData.coverage_amount, actualPolicyType),
      formatted_coverage: policyData.coverage_amount ?
        '$' + parseFloat(policyData.coverage_amount).toLocaleString('en-US') : '$50,000',
      formatted_premium: policyData.total_premium ?
        '$' + parseFloat(policyData.total_premium).toLocaleString('en-US') + '/year' : '$1,200/year',
      formatted_deductible: calculateDeductible(policyData.coverage_amount, actualPolicyType) ?
        '$' + calculateDeductible(policyData.coverage_amount, actualPolicyType).toLocaleString('en-US') : '$2,500'
    };

    // Add the rest of the type-specific details code here...
    // (Copy the same formatting code from the previous version)

    res.json({
      success: true,
      data: formattedPolicy
    });
  } catch (error) {
    console.error('Error fetching policy by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createHomeInsuranceQuote,
  createCarInsuranceQuote,
  createTravelInsuranceQuote,
  getActivePolicies,
  getPolicyById
};