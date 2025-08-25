const { getConnection } = require('../config/database');

// controllers/insuranceController.js
// ---------- helpers ----------
const toNull = (v) => (v === undefined ? null : v);
const numOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const dateOrNull = (v) => {
  if (!v) return null;
  // Accept "YYYY-MM-DD" or ISO, store "YYYY-MM-DD"
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

// Check if a column exists before inserting into it (avoids SQL errors on older schemas)
async function tableHasColumn(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS cnt 
       FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows?.[0]?.cnt > 0;
}

// ---------- HOME ----------
exports.createHomeInsuranceQuote = async (req, res, next) => {
  const connection = getConnection();
  try {
    // Debug raw body
    console.log('[HOME] req.body:', JSON.stringify(req.body, null, 2));

    const {
      // Web3 identifiers (recommended)
      wallet_address,
      tx_hash,
      chain_id,
      payment_currency,
      premium_eth,

      // Business fields
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
    } = req.body || {};

    // Validate must-haves (adjust as your schema requires)
    const missing = [];
    if (!wallet_address) missing.push('wallet_address');
    if (!policy_start_date) missing.push('policy_start_date');
    if (!policy_end_date) missing.push('policy_end_date');
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missing
      });
    }

    // Build dynamic column list (add tx details if your table has them)
    const cols = [
      'wallet_address',
      'house_type',
      'year_built',
      'house_address',
      'property_owner_name',
      'property_owner_telephone',
      'property_owner_email',
      'policy_start_date',
      'policy_end_date',
      'coverage_duration'
    ];
    const vals = [
      toNull(wallet_address),
      toNull(house_type),
      numOrNull(year_built),
      toNull(house_address),
      toNull(property_owner_name),
      toNull(property_owner_telephone),
      toNull(property_owner_email),
      dateOrNull(policy_start_date),
      dateOrNull(policy_end_date),
      numOrNull(coverage_duration)
    ];

    // Add optional business columns if present
    if (await tableHasColumn(connection, 'home_insurance_quotes', 'coverage_amount')) {
      cols.push('coverage_amount');
      vals.push(numOrNull(coverage_amount));
    }
    if (await tableHasColumn(connection, 'home_insurance_quotes', 'total_premium')) {
      cols.push('total_premium');
      vals.push(numOrNull(total_premium));
    }

    // Add optional web3 columns if present
    if (await tableHasColumn(connection, 'home_insurance_quotes', 'tx_hash')) {
      cols.push('tx_hash');
      vals.push(toNull(tx_hash));
    }
    if (await tableHasColumn(connection, 'home_insurance_quotes', 'chain_id')) {
      cols.push('chain_id');
      vals.push(toNull(chain_id));
    }
    if (await tableHasColumn(connection, 'home_insurance_quotes', 'payment_currency')) {
      cols.push('payment_currency');
      vals.push(toNull(payment_currency));
    }
    if (await tableHasColumn(connection, 'home_insurance_quotes', 'premium_eth')) {
      cols.push('premium_eth');
      vals.push(numOrNull(premium_eth));
    }

    const placeholders = cols.map(() => '?').join(', ');
    const sql = `
      INSERT INTO home_insurance_quotes
        (${cols.join(', ')})
      VALUES (${placeholders})
    `;

    console.log('[HOME] INSERT columns:', cols);
    console.log('[HOME] INSERT values:', vals);

    const [result] = await connection.execute(sql, vals);
    return res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error creating home insurance quote:', err);
    return next(err);
  }
};

// ---------- CAR ----------
exports.createCarInsuranceQuote = async (req, res, next) => {
  const connection = getConnection();
  try {
    console.log('[CAR] req.body:', JSON.stringify(req.body, null, 2));

    const {
      wallet_address,
      tx_hash,
      chain_id,
      payment_currency,
      premium_eth,

      car_make,
      car_model,
      car_year,
      mileage,
      policy_start_date,
      policy_end_date,
      coverage_duration,
      coverage_amount,
      total_premium
    } = req.body || {};

    const missing = [];
    if (!wallet_address) missing.push('wallet_address');
    if (!policy_start_date) missing.push('policy_start_date');
    if (!policy_end_date) missing.push('policy_end_date');
    if (missing.length) {
      return res.status(400).json({ success: false, message: 'Missing required fields', missing });
    }

    const cols = [
      'wallet_address',
      'car_make',
      'car_model',
      'car_year',
      'mileage',
      'policy_start_date',
      'policy_end_date',
      'coverage_duration'
    ];
    const vals = [
      toNull(wallet_address),
      toNull(car_make),
      toNull(car_model),
      numOrNull(car_year),
      numOrNull(mileage),
      dateOrNull(policy_start_date),
      dateOrNull(policy_end_date),
      numOrNull(coverage_duration)
    ];

    if (await tableHasColumn(connection, 'car_insurance_quotes', 'coverage_amount')) {
      cols.push('coverage_amount');
      vals.push(numOrNull(coverage_amount));
    }
    if (await tableHasColumn(connection, 'car_insurance_quotes', 'total_premium')) {
      cols.push('total_premium');
      vals.push(numOrNull(total_premium));
    }
    if (await tableHasColumn(connection, 'car_insurance_quotes', 'tx_hash')) {
      cols.push('tx_hash');
      vals.push(toNull(tx_hash));
    }
    if (await tableHasColumn(connection, 'car_insurance_quotes', 'chain_id')) {
      cols.push('chain_id');
      vals.push(toNull(chain_id));
    }
    if (await tableHasColumn(connection, 'car_insurance_quotes', 'payment_currency')) {
      cols.push('payment_currency');
      vals.push(toNull(payment_currency));
    }
    if (await tableHasColumn(connection, 'car_insurance_quotes', 'premium_eth')) {
      cols.push('premium_eth');
      vals.push(numOrNull(premium_eth));
    }

    const placeholders = cols.map(() => '?').join(', ');
    const sql = `
      INSERT INTO car_insurance_quotes
        (${cols.join(', ')})
      VALUES (${placeholders})
    `;

    console.log('[CAR] INSERT columns:', cols);
    console.log('[CAR] INSERT values:', vals);

    const [result] = await connection.execute(sql, vals);
    return res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error creating car insurance quote:', err);
    return next(err);
  }
};

// ---------- TRAVEL ----------
exports.createTravelInsuranceQuote = async (req, res, next) => {
  const connection = getConnection();
  try {
    console.log('[TRAVEL] req.body:', JSON.stringify(req.body, null, 2));

    const {
      wallet_address,
      tx_hash,
      chain_id,
      payment_currency,
      premium_eth,

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
    } = req.body || {};

    const missing = [];
    if (!wallet_address) missing.push('wallet_address');
    if (!travel_start_date) missing.push('travel_start_date');
    if (!travel_end_date) missing.push('travel_end_date');
    if (missing.length) {
      return res.status(400).json({ success: false, message: 'Missing required fields', missing });
    }

    const cols = [
      'wallet_address',
      'origin',
      'departure',
      'destination',
      'passport_number',
      'passport_country',
      'travel_start_date',
      'travel_end_date',
      'coverage_duration'
    ];
    const vals = [
      toNull(wallet_address),
      toNull(origin),
      dateOrNull(departure),
      toNull(destination),
      toNull(passport_number),
      toNull(passport_country),
      dateOrNull(travel_start_date),
      dateOrNull(travel_end_date),
      numOrNull(coverage_duration)
    ];

    if (await tableHasColumn(connection, 'travel_insurance_quotes', 'coverage_amount')) {
      cols.push('coverage_amount');
      vals.push(numOrNull(coverage_amount));
    }
    if (await tableHasColumn(connection, 'travel_insurance_quotes', 'total_premium')) {
      cols.push('total_premium');
      vals.push(numOrNull(total_premium));
    }
    if (await tableHasColumn(connection, 'travel_insurance_quotes', 'tx_hash')) {
      cols.push('tx_hash');
      vals.push(toNull(tx_hash));
    }
    if (await tableHasColumn(connection, 'travel_insurance_quotes', 'chain_id')) {
      cols.push('chain_id');
      vals.push(toNull(chain_id));
    }
    if (await tableHasColumn(connection, 'travel_insurance_quotes', 'payment_currency')) {
      cols.push('payment_currency');
      vals.push(toNull(payment_currency));
    }
    if (await tableHasColumn(connection, 'travel_insurance_quotes', 'premium_eth')) {
      cols.push('premium_eth');
      vals.push(numOrNull(premium_eth));
    }

    const placeholders = cols.map(() => '?').join(', ');
    const sql = `
      INSERT INTO travel_insurance_quotes
        (${cols.join(', ')})
      VALUES (${placeholders})
    `;

    console.log('[TRAVEL] INSERT columns:', cols);
    console.log('[TRAVEL] INSERT values:', vals);

    const [result] = await connection.execute(sql, vals);
    return res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error creating travel insurance quote:', err);
    return next(err);
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