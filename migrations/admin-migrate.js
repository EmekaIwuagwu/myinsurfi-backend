const { connectDB } = require('../config/database');

const createAdminTables = async () => {
  const connection = await connectDB();

  try {
    // Admin Users Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'admin', 'moderator') DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);

    // Insert default admin user
    await connection.execute(`
      INSERT IGNORE INTO admin_users (email, password, name, role) 
      VALUES ('admin@myinsurfi.io', 'admin@myinsurfi', 'Admin User', 'super_admin')
    `);

    // Admin Sessions Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
        INDEX idx_session_token (session_token),
        INDEX idx_admin_id (admin_id)
      )
    `);

    // Function to check if column exists
    const columnExists = async (tableName, columnName) => {
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

    // Update existing tables to support admin operations
    const tables = ['home_insurance_quotes', 'car_insurance_quotes', 'travel_insurance_quotes'];
    
    for (const table of tables) {
      // Add status column
      if (!(await columnExists(table, 'status'))) {
        await connection.execute(`
          ALTER TABLE ${table} 
          ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
        `);
      }
      
      // Add reviewed by admin
      if (!(await columnExists(table, 'reviewed_by'))) {
        await connection.execute(`
          ALTER TABLE ${table} 
          ADD COLUMN reviewed_by INT NULL
        `);
      }

      if (!(await columnExists(table, 'reviewed_at'))) {
        await connection.execute(`
          ALTER TABLE ${table} 
          ADD COLUMN reviewed_at TIMESTAMP NULL
        `);
      }

      if (!(await columnExists(table, 'admin_notes'))) {
        await connection.execute(`
          ALTER TABLE ${table} 
          ADD COLUMN admin_notes TEXT NULL
        `);
      }
      
      // Add foreign key if not exists
      try {
        await connection.execute(`
          ALTER TABLE ${table} 
          ADD CONSTRAINT fk_${table}_admin 
          FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL
        `);
      } catch (error) {
        console.log(`Foreign key for ${table} might already exist`);
      }
    }

    // Claims Table - Enhanced version
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS insurance_claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        claim_id VARCHAR(20) UNIQUE NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        policy_type ENUM('home', 'car', 'travel') NOT NULL,
        policy_id INT NOT NULL,
        claim_amount DECIMAL(15,2) NOT NULL,
        description TEXT NOT NULL,
        incident_date DATE NOT NULL,
        documents_count INT DEFAULT 0,
        status ENUM('pending', 'approved', 'rejected', 'processing_payment', 'paid') DEFAULT 'pending',
        reviewed_by INT NULL,
        reviewed_at TIMESTAMP NULL,
        admin_notes TEXT NULL,
        payout_amount DECIMAL(15,2) NULL,
        payout_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wallet_address (wallet_address),
        INDEX idx_claim_id (claim_id),
        INDEX idx_policy_type (policy_type),
        INDEX idx_status (status),
        FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL
      )
    `);

    // Claim Documents Table for file storage
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS claim_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        claim_id VARCHAR(20) NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_data LONGTEXT NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        uploaded_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_claim_id (claim_id),
        INDEX idx_document_type (document_type),
        FOREIGN KEY (claim_id) REFERENCES insurance_claims(claim_id) ON DELETE CASCADE
      )
    `);

    // Platform Analytics Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS platform_analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        metric_value DECIMAL(15,2) NOT NULL,
        additional_data JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_date_metric (date, metric_type),
        INDEX idx_date (date),
        INDEX idx_metric_type (metric_type)
      )
    `);

    // Admin Activity Log
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(50) NULL,
        details JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
        INDEX idx_admin_id (admin_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      )
    `);

    // Update messages table for admin context
    if (!(await columnExists('messages', 'priority'))) {
      await connection.execute(`
        ALTER TABLE messages 
        ADD COLUMN priority ENUM('low', 'medium', 'high') DEFAULT 'low'
      `);
    }

    if (!(await columnExists('messages', 'admin_assigned'))) {
      await connection.execute(`
        ALTER TABLE messages 
        ADD COLUMN admin_assigned INT NULL
      `);
    }

    if (!(await columnExists('messages', 'status'))) {
      await connection.execute(`
        ALTER TABLE messages 
        ADD COLUMN status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open'
      `);
    }

    try {
      await connection.execute(`
        ALTER TABLE messages 
        ADD CONSTRAINT fk_messages_admin 
        FOREIGN KEY (admin_assigned) REFERENCES admin_users(id) ON DELETE SET NULL
      `);
    } catch (error) {
      console.log('Foreign key for messages might already exist');
    }

    console.log('All admin tables created successfully!');
    console.log('✅ claim_documents table created!');
    
    // Insert some sample data for testing
    await insertSampleData(connection);
    
    process.exit(0);
  } catch (error) {
    console.error('Admin migration failed:', error);
    process.exit(1);
  }
};

const insertSampleData = async (connection) => {
  try {
    // Insert sample claims
    const sampleClaims = [
      ['CLM-001', '0x1234567890abcdef1234567890abcdef12345678', 'home', 1, 15000.00, 'Water damage to kitchen due to pipe burst', '2024-01-18', 3, 'pending'],
      ['CLM-002', '0x9876543210fedcba9876543210fedcba98765432', 'car', 1, 8500.00, 'Collision damage to vehicle front end', '2024-02-03', 5, 'approved'],
      ['CLM-003', '0xabcdef1234567890abcdef1234567890abcdef12', 'travel', 1, 2000.00, 'Trip cancellation due to illness', '2024-01-15', 2, 'rejected']
    ];

    for (const claim of sampleClaims) {
      await connection.execute(`
        INSERT IGNORE INTO insurance_claims 
        (claim_id, wallet_address, policy_type, policy_id, claim_amount, description, incident_date, documents_count, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, claim);
    }

    // Insert sample analytics data
    const today = new Date();
    const dates = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    for (const date of dates) {
      const views = Math.floor(Math.random() * 1000) + 1500;
      await connection.execute(`
        INSERT IGNORE INTO platform_analytics (date, metric_type, metric_value) 
        VALUES (?, 'daily_views', ?)
      `, [date, views]);
    }

    // Insert sample messages
    const sampleMessages = [
      ['0x1234567890abcdef1234567890abcdef12345678', 'Issue with claim processing', 'Hello, I submitted a claim for my home insurance policy 3 days ago but haven\'t received any updates. Can you please check the status?', 'high'],
      ['0x9876543210fedcba9876543210fedcba98765432', 'Question about coverage', 'Hi, I want to understand what exactly is covered under my car insurance policy. Could you provide more details about the coverage limits?', 'medium'],
      ['0xabcdef1234567890abcdef1234567890abcdef12', 'Premium payment inquiry', 'I tried to pay my premium using my wallet but the transaction failed. Can you help me understand what went wrong?', 'medium']
    ];

    for (const message of sampleMessages) {
      await connection.execute(`
        INSERT IGNORE INTO messages 
        (wallet_address, sender_type, subject, message, priority) 
        VALUES (?, 'user', ?, ?, ?)
      `, message);
    }

    console.log('Sample data inserted successfully!');
  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
};

createAdminTables();