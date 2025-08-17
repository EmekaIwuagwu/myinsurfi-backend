const { getConnection } = require('../config/database');

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

    // Create notification
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

// Create Car Insurance Quote
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
      coverage_duration
    } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address is required' 
      });
    }

    const connection = getConnection();
    
    const [result] = await connection.execute(
      `INSERT INTO car_insurance_quotes 
       (wallet_address, car_make, car_model, car_year, mileage, 
        policy_start_date, policy_end_date, coverage_duration) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [wallet_address, car_make, car_model, car_year, mileage,
       policy_start_date, policy_end_date, coverage_duration]
    );

    // Create notification
    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'car_insurance', 'Car Insurance Quote Created', 
       'Your car insurance quote has been successfully created.']
    );

    res.status(201).json({
      success: true,
      message: 'Car insurance quote created successfully',
      data: { id: result.insertId }
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

// Create Travel Insurance Quote
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
      coverage_duration
    } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address is required' 
      });
    }

    const connection = getConnection();
    
    const [result] = await connection.execute(
      `INSERT INTO travel_insurance_quotes 
       (wallet_address, origin, departure, destination, passport_number, 
        passport_country, travel_start_date, travel_end_date, coverage_duration) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [wallet_address, origin, departure, destination, passport_number,
       passport_country, travel_start_date, travel_end_date, coverage_duration]
    );

    // Create notification
    await connection.execute(
      `INSERT INTO notifications (wallet_address, type, title, message) 
       VALUES (?, ?, ?, ?)`,
      [wallet_address, 'travel_insurance', 'Travel Insurance Quote Created', 
       'Your travel insurance quote has been successfully created.']
    );

    res.status(201).json({
      success: true,
      message: 'Travel insurance quote created successfully',
      data: { id: result.insertId }
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
    
    // Union query to get all policies
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
         NULL as amount, NULL as premium,
         policy_start_date, policy_end_date, created_at
       FROM car_insurance_quotes 
       WHERE wallet_address = ?)
       UNION ALL
       (SELECT 
         id, wallet_address, 'travel' as policy_type,
         CONCAT(origin, ' to ', destination) as detail_1, passport_country as detail_2,
         NULL as amount, NULL as premium,
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

module.exports = {
  createHomeInsuranceQuote,
  createCarInsuranceQuote,
  createTravelInsuranceQuote,
  getActivePolicies
};
