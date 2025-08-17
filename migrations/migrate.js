const { connectDB } = require('../config/database');

const createTables = async () => {
  const connection = await connectDB();

  try {
    // Home Insurance Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS home_insurance_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(255) NOT NULL,
        house_type VARCHAR(100) NOT NULL,
        year_built INT NOT NULL,
        house_address TEXT NOT NULL,
        property_owner_name VARCHAR(255) NOT NULL,
        property_owner_telephone VARCHAR(20) NOT NULL,
        property_owner_email VARCHAR(255) NOT NULL,
        policy_start_date DATE NOT NULL,
        policy_end_date DATE NOT NULL,
        coverage_duration INT NOT NULL,
        coverage_amount DECIMAL(15,2) NOT NULL,
        total_premium DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_address (wallet_address)
      )
    `);

    // Car Insurance Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS car_insurance_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(255) NOT NULL,
        car_make VARCHAR(100) NOT NULL,
        car_model VARCHAR(100) NOT NULL,
        car_year INT NOT NULL,
        mileage INT NOT NULL,
        policy_start_date DATE NOT NULL,
        policy_end_date DATE NOT NULL,
        coverage_duration INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_address (wallet_address)
      )
    `);

    // Travel Insurance Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS travel_insurance_quotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(255) NOT NULL,
        origin VARCHAR(255) NOT NULL,
        departure DATE NOT NULL,
        destination VARCHAR(255) NOT NULL,
        passport_number VARCHAR(50) NOT NULL,
        passport_country VARCHAR(100) NOT NULL,
        travel_start_date DATE NOT NULL,
        travel_end_date DATE NOT NULL,
        coverage_duration INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_address (wallet_address)
      )
    `);

    // Messages Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(255) NOT NULL,
        sender_type ENUM('user', 'admin') NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        priority ENUM('low', 'medium', 'high') DEFAULT 'low',
        is_read BOOLEAN DEFAULT FALSE,
        parent_message_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wallet_address (wallet_address),
        INDEX idx_parent_message (parent_message_id),
        FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);

    // Notifications Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_address (wallet_address)
      )
    `);

    console.log('All tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

createTables();