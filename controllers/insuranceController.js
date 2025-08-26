const { getConnection } = require('../config/database');

// Import PDF and Email services
const {
  generateHomeInsurancePDF,
  generateCarInsurancePDF,
  generateTravelInsurancePDF,
  generateNameFromWallet,
  cleanTextForPDF
} = require('../services/pdfService');

const { sendPolicyEmail } = require('../services/emailService');

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

// Helper function to generate policy data for PDF/Email
const formatPolicyDataForPDF = (rawData, policyType) => {
  const policyNumber = `${policyType.toUpperCase().substring(0, 2)}-${new Date().getFullYear()}-${rawData.id}`;
  
  // Clean all text fields to ensure PDF compatibility
  const cleanData = {};
  for (const [key, value] of Object.entries(rawData)) {
    if (typeof value === 'string') {
      cleanData[key] = cleanTextForPDF(value);
    } else {
      cleanData[key] = value;
    }
  }
  
  return {
    ...cleanData,
    policy_number: policyNumber,
    policy_type: policyType,
    formatted_coverage: cleanData.coverage_amount ? 
      `$${parseFloat(cleanData.coverage_amount).toLocaleString('en-US')}` : 
      null,
    formatted_premium: cleanData.total_premium ? 
      `$${parseFloat(cleanData.total_premium).toLocaleString('en-US')}` : 
      null,
    customer_name: cleanData.property_owner_name || cleanData.car_owner_name || cleanData.traveler_name || generateNameFromWallet(cleanData.wallet_address),
    customer_email: cleanData.property_owner_email || cleanData.car_owner_email || cleanData.traveler_email || `${generateNameFromWallet(cleanData.wallet_address).toLowerCase().replace(' ', '.')}@example.com`
  };
};

// Helper function to handle PDF generation and email sending
const generateAndSendPolicyPDF = async (policyData, policyType) => {
  try {
    console.log(`🔄 Generating ${policyType} insurance PDF for policy ID: ${policyData.id}`);
    
    let pdfBuffer;
    
    // Generate PDF based on policy type
    switch (policyType) {
      case 'home':
        pdfBuffer = await generateHomeInsurancePDF(policyData);
        break;
      case 'car':
        pdfBuffer = await generateCarInsurancePDF(policyData);
        break;
      case 'travel':
        pdfBuffer = await generateTravelInsurancePDF(policyData);
        break;
      default:
        throw new Error(`Unknown policy type: ${policyType}`);
    }
    
    console.log(`✅ PDF generated successfully for ${policyType} insurance`);
    
    // Send email with PDF if customer email is available
    if (policyData.customer_email && policyData.customer_email !== 'N/A') {
      console.log(`📧 Sending policy email to: ${policyData.customer_email}`);
      
      await sendPolicyEmail(
        policyData.customer_email,
        policyData,
        pdfBuffer,
        policyType
      );
      
      console.log(`✅ Policy email sent successfully for ${policyType} insurance`);
    } else {
      console.log(`⚠️  No valid email address found, PDF generated but not sent`);
    }
    
    return { success: true, pdfGenerated: true, emailSent: !!policyData.customer_email };
    
  } catch (error) {
    console.error(`❌ Error generating/sending ${policyType} insurance PDF:`, error);
    // Don't throw error to prevent policy creation failure
    return { success: false, error: error.message, pdfGenerated: false, emailSent: false };
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

    // Get the created policy data
    const [policyData] = await connection.execute(
      'SELECT * FROM home_insurance_quotes WHERE id = ?',
      [result.insertId]
    );

    // Create notification
    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'home_insurance', 'Home Insurance Quote Created',
        'Your home insurance quote has been successfully created.']
    );

    // Format policy data for PDF/Email
    const formattedPolicyData = formatPolicyDataForPDF(policyData[0], 'home');
    
    // Generate PDF and send email (async, don't wait for completion)
    generateAndSendPolicyPDF(formattedPolicyData, 'home')
      .then(result => {
        console.log('📄 Home insurance PDF/Email result:', result);
      })
      .catch(error => {
        console.error('🚫 Home insurance PDF/Email error:', error);
      });

    res.status(201).json({
      success: true,
      message: 'Home insurance quote created successfully',
      data: { 
        id: result.insertId,
        policy_number: formattedPolicyData.policy_number,
        pdf_generation: 'initiated',
        email_sending: 'initiated'
      }
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

// Create Car Insurance Quote (UPDATED WITH EMAIL FIELDS)
const createCarInsuranceQuote = async (req, res) => {
  try {
    const {
      wallet_address,
      car_make,
      car_model,
      car_year,
      mileage,
      car_owner_name,          // NEW: Added owner name
      car_owner_email,         // NEW: Added owner email  
      car_owner_telephone,     // NEW: Added owner telephone
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

    // Check which columns exist
    const hasCoverageAmount = await columnExists(connection, 'car_insurance_quotes', 'coverage_amount');
    const hasTotalPremium = await columnExists(connection, 'car_insurance_quotes', 'total_premium');
    const hasOwnerName = await columnExists(connection, 'car_insurance_quotes', 'car_owner_name');
    const hasOwnerEmail = await columnExists(connection, 'car_insurance_quotes', 'car_owner_email');
    const hasOwnerPhone = await columnExists(connection, 'car_insurance_quotes', 'car_owner_telephone');

    let query = `INSERT INTO car_insurance_quotes (wallet_address, car_make, car_model, car_year, mileage, policy_start_date, policy_end_date, coverage_duration`;
    let values = [wallet_address, car_make, car_model, car_year, mileage, policy_start_date, policy_end_date, coverage_duration];
    let placeholders = `?, ?, ?, ?, ?, ?, ?, ?`;

    // Add optional columns if they exist
    if (hasCoverageAmount) {
      query += `, coverage_amount`;
      placeholders += `, ?`;
      values.push(coverage_amount || 50000);
    }
    
    if (hasTotalPremium) {
      query += `, total_premium`;
      placeholders += `, ?`;
      values.push(total_premium || 1200);
    }
    
    if (hasOwnerName && car_owner_name) {
      query += `, car_owner_name`;
      placeholders += `, ?`;
      values.push(car_owner_name);
    }
    
    if (hasOwnerEmail && car_owner_email) {
      query += `, car_owner_email`;
      placeholders += `, ?`;
      values.push(car_owner_email);
    }
    
    if (hasOwnerPhone && car_owner_telephone) {
      query += `, car_owner_telephone`;
      placeholders += `, ?`;
      values.push(car_owner_telephone);
    }

    query += `) VALUES (${placeholders})`;

    const [result] = await connection.execute(query, values);

    // Get the created policy data
    const [policyData] = await connection.execute(
      'SELECT * FROM car_insurance_quotes WHERE id = ?',
      [result.insertId]
    );

    // Create notification
    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'car_insurance', 'Car Insurance Quote Created',
        'Your car insurance quote has been successfully created.']
    );

    // Add default values for missing columns
    const policyDataWithDefaults = {
      ...policyData[0],
      coverage_amount: policyData[0].coverage_amount || coverage_amount || 50000,
      total_premium: policyData[0].total_premium || total_premium || 1200,
      car_owner_name: policyData[0].car_owner_name || car_owner_name,
      car_owner_email: policyData[0].car_owner_email || car_owner_email,
      car_owner_telephone: policyData[0].car_owner_telephone || car_owner_telephone
    };

    // Format policy data for PDF/Email
    const formattedPolicyData = formatPolicyDataForPDF(policyDataWithDefaults, 'car');
    
    // Generate PDF and send email (async, don't wait for completion)
    generateAndSendPolicyPDF(formattedPolicyData, 'car')
      .then(result => {
        console.log('📄 Car insurance PDF/Email result:', result);
      })
      .catch(error => {
        console.error('🚫 Car insurance PDF/Email error:', error);
      });

    const responseData = { 
      id: result.insertId,
      policy_number: formattedPolicyData.policy_number,
      pdf_generation: 'initiated',
      email_sending: 'initiated'
    };

    if (hasCoverageAmount) responseData.coverage_amount = policyDataWithDefaults.coverage_amount;
    if (hasTotalPremium) responseData.total_premium = policyDataWithDefaults.total_premium;

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

// Create Travel Insurance Quote (UPDATED WITH EMAIL FIELDS)
const createTravelInsuranceQuote = async (req, res) => {
  try {
    const {
      wallet_address,
      origin,
      departure,
      destination,
      passport_number,
      passport_country,
      traveler_name,           // NEW: Added traveler name
      traveler_email,          // NEW: Added traveler email
      traveler_telephone,      // NEW: Added traveler telephone  
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

    // Check which columns exist
    const hasCoverageAmount = await columnExists(connection, 'travel_insurance_quotes', 'coverage_amount');
    const hasTotalPremium = await columnExists(connection, 'travel_insurance_quotes', 'total_premium');
    const hasTravelerName = await columnExists(connection, 'travel_insurance_quotes', 'traveler_name');
    const hasTravelerEmail = await columnExists(connection, 'travel_insurance_quotes', 'traveler_email');
    const hasTravelerPhone = await columnExists(connection, 'travel_insurance_quotes', 'traveler_telephone');

    let query = `INSERT INTO travel_insurance_quotes (wallet_address, origin, departure, destination, passport_number, passport_country, travel_start_date, travel_end_date, coverage_duration`;
    let values = [wallet_address, origin, departure, destination, passport_number, passport_country, travel_start_date, travel_end_date, coverage_duration];
    let placeholders = `?, ?, ?, ?, ?, ?, ?, ?, ?`;

    // Add optional columns if they exist
    if (hasCoverageAmount) {
      query += `, coverage_amount`;
      placeholders += `, ?`;
      values.push(coverage_amount || 25000);
    }
    
    if (hasTotalPremium) {
      query += `, total_premium`;
      placeholders += `, ?`;
      values.push(total_premium || 300);
    }
    
    if (hasTravelerName && traveler_name) {
      query += `, traveler_name`;
      placeholders += `, ?`;
      values.push(traveler_name);
    }
    
    if (hasTravelerEmail && traveler_email) {
      query += `, traveler_email`;
      placeholders += `, ?`;
      values.push(traveler_email);
    }
    
    if (hasTravelerPhone && traveler_telephone) {
      query += `, traveler_telephone`;
      placeholders += `, ?`;
      values.push(traveler_telephone);
    }

    query += `) VALUES (${placeholders})`;

    const [result] = await connection.execute(query, values);

    // Get the created policy data
    const [policyData] = await connection.execute(
      'SELECT * FROM travel_insurance_quotes WHERE id = ?',
      [result.insertId]
    );

    // Create notification
    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'travel_insurance', 'Travel Insurance Quote Created',
        'Your travel insurance quote has been successfully created.']
    );

    // Add default values for missing columns
    const policyDataWithDefaults = {
      ...policyData[0],
      coverage_amount: policyData[0].coverage_amount || coverage_amount || 25000,
      total_premium: policyData[0].total_premium || total_premium || 300,
      traveler_name: policyData[0].traveler_name || traveler_name,
      traveler_email: policyData[0].traveler_email || traveler_email,
      traveler_telephone: policyData[0].traveler_telephone || traveler_telephone
    };

    // Format policy data for PDF/Email
    const formattedPolicyData = formatPolicyDataForPDF(policyDataWithDefaults, 'travel');
    
    // Generate PDF and send email (async, don't wait for completion)
    generateAndSendPolicyPDF(formattedPolicyData, 'travel')
      .then(result => {
        console.log('📄 Travel insurance PDF/Email result:', result);
      })
      .catch(error => {
        console.error('🚫 Travel insurance PDF/Email error:', error);
      });

    const responseData = { 
      id: result.insertId,
      policy_number: formattedPolicyData.policy_number,
      pdf_generation: 'initiated',
      email_sending: 'initiated'
    };

    if (hasCoverageAmount) responseData.coverage_amount = policyDataWithDefaults.coverage_amount;
    if (hasTotalPremium) responseData.total_premium = policyDataWithDefaults.total_premium;

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

// Get Active Policies (unchanged)
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

// Get Single Policy Details by ID with Policy Type (unchanged but improved)
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
        let carQuery = `SELECT *, 'car' as policy_type FROM car_insurance_quotes WHERE id = ?`;
        if (wallet_address) carQuery += ` AND wallet_address = ?`;

        const [carPolicies] = await connection.execute(carQuery,
          wallet_address ? [policy_id, wallet_address] : [policy_id]);

        if (carPolicies.length > 0) {
          policyData = carPolicies[0];
          actualPolicyType = 'car';
        }
      } else if (policy_type === 'travel') {
        let travelQuery = `SELECT *, 'travel' as policy_type FROM travel_insurance_quotes WHERE id = ?`;
        if (wallet_address) travelQuery += ` AND wallet_address = ?`;

        const [travelPolicies] = await connection.execute(travelQuery,
          wallet_address ? [policy_id, wallet_address] : [policy_id]);

        if (travelPolicies.length > 0) {
          policyData = travelPolicies[0];
          actualPolicyType = 'travel';
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
        let carQuery = `SELECT *, 'car' as policy_type FROM car_insurance_quotes WHERE id = ?`;
        if (wallet_address) carQuery += ` AND wallet_address = ?`;

        const [carPolicies] = await connection.execute(carQuery,
          wallet_address ? [policy_id, wallet_address] : [policy_id]);

        if (carPolicies.length > 0) {
          policyData = carPolicies[0];
          actualPolicyType = 'car';
        } else {
          // Check Travel Insurance
          let travelQuery = `SELECT *, 'travel' as policy_type FROM travel_insurance_quotes WHERE id = ?`;
          if (wallet_address) travelQuery += ` AND wallet_address = ?`;

          const [travelPolicies] = await connection.execute(travelQuery,
            wallet_address ? [policy_id, wallet_address] : [policy_id]);

          if (travelPolicies.length > 0) {
            policyData = travelPolicies[0];
            actualPolicyType = 'travel';
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
      coverage_amount: policyData.coverage_amount || (actualPolicyType === 'car' ? 50000 : actualPolicyType === 'travel' ? 25000 : 250000),
      total_premium: policyData.total_premium || (actualPolicyType === 'car' ? 1200 : actualPolicyType === 'travel' ? 300 : 1200),
      deductible: calculateDeductible(policyData.coverage_amount, actualPolicyType),
      formatted_coverage: policyData.coverage_amount ?
        '$' + parseFloat(policyData.coverage_amount).toLocaleString('en-US') : '$50,000',
      formatted_premium: policyData.total_premium ?
        '$' + parseFloat(policyData.total_premium).toLocaleString('en-US') + '/year' : '$1,200/year',
      formatted_deductible: calculateDeductible(policyData.coverage_amount, actualPolicyType) ?
        '$' + calculateDeductible(policyData.coverage_amount, actualPolicyType).toLocaleString('en-US') : '$2,500'
    };

    // Add type-specific details including email fields
    if (actualPolicyType === 'home') {
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
        coverage_duration: policyData.coverage_duration
      };
    } else if (actualPolicyType === 'car') {
      formattedPolicy = {
        ...formattedPolicy,
        car_make: policyData.car_make,
        car_model: policyData.car_model,
        car_year: policyData.car_year,
        mileage: policyData.mileage,
        car_owner_name: policyData.car_owner_name,           // NEW: Added email fields
        car_owner_email: policyData.car_owner_email,         // NEW: Added email fields
        car_owner_telephone: policyData.car_owner_telephone, // NEW: Added email fields
        policy_start_date: policyData.policy_start_date,
        policy_end_date: policyData.policy_end_date,
        coverage_duration: policyData.coverage_duration,
        vehicle_description: `${policyData.car_year} ${policyData.car_make} ${policyData.car_model}`
      };
    } else if (actualPolicyType === 'travel') {
      formattedPolicy = {
        ...formattedPolicy,
        origin: policyData.origin,
        departure: policyData.departure,
        destination: policyData.destination,
        passport_number: policyData.passport_number,
        passport_country: policyData.passport_country,
        traveler_name: policyData.traveler_name,               // NEW: Added email fields
        traveler_email: policyData.traveler_email,             // NEW: Added email fields
        traveler_telephone: policyData.traveler_telephone,     // NEW: Added email fields
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