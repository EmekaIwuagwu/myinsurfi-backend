// migrations/add-coverage-amount.js
const { connectDB } = require('../config/database');

const addCoverageAmount = async () => {
  const connection = await connectDB();

  try {
    console.log('Adding coverage_amount column to car_insurance_quotes and travel_insurance_quotes tables...');

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

    // Add coverage_amount to car_insurance_quotes table
    if (!(await columnExists('car_insurance_quotes', 'coverage_amount'))) {
      await connection.execute(`
        ALTER TABLE car_insurance_quotes 
        ADD COLUMN coverage_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00
      `);
      console.log('✅ Added coverage_amount column to car_insurance_quotes table');
    } else {
      console.log('ℹ️  coverage_amount column already exists in car_insurance_quotes table');
    }

    // Add coverage_amount to travel_insurance_quotes table  
    if (!(await columnExists('travel_insurance_quotes', 'coverage_amount'))) {
      await connection.execute(`
        ALTER TABLE travel_insurance_quotes 
        ADD COLUMN coverage_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00
      `);
      console.log('✅ Added coverage_amount column to travel_insurance_quotes table');
    } else {
      console.log('ℹ️  coverage_amount column already exists in travel_insurance_quotes table');
    }

    // Add total_premium to car_insurance_quotes table (for consistency)
    if (!(await columnExists('car_insurance_quotes', 'total_premium'))) {
      await connection.execute(`
        ALTER TABLE car_insurance_quotes 
        ADD COLUMN total_premium DECIMAL(15,2) NOT NULL DEFAULT 0.00
      `);
      console.log('✅ Added total_premium column to car_insurance_quotes table');
    } else {
      console.log('ℹ️  total_premium column already exists in car_insurance_quotes table');
    }

    // Add total_premium to travel_insurance_quotes table (for consistency)
    if (!(await columnExists('travel_insurance_quotes', 'total_premium'))) {
      await connection.execute(`
        ALTER TABLE travel_insurance_quotes 
        ADD COLUMN total_premium DECIMAL(15,2) NOT NULL DEFAULT 0.00
      `);
      console.log('✅ Added total_premium column to travel_insurance_quotes table');
    } else {
      console.log('ℹ️  total_premium column already exists in travel_insurance_quotes table');
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

addCoverageAmount();