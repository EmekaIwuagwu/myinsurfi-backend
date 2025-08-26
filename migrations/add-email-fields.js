// migrations/add-email-fields.js
const { connectDB } = require('../config/database');

const addEmailFields = async () => {
  const connection = await connectDB();

  try {
    console.log('Adding/updating email fields for car and travel insurance tables...');

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

    // Add car_owner_email to car_insurance_quotes table if it doesn't exist
    if (!(await columnExists('car_insurance_quotes', 'car_owner_email'))) {
      await connection.execute(`
        ALTER TABLE car_insurance_quotes 
        ADD COLUMN car_owner_email VARCHAR(255) NULL
      `);
      console.log('✅ Added car_owner_email column to car_insurance_quotes table');
    } else {
      console.log('ℹ️  car_owner_email column already exists in car_insurance_quotes table');
    }

    // Add traveler_email to travel_insurance_quotes table if it doesn't exist
    if (!(await columnExists('travel_insurance_quotes', 'traveler_email'))) {
      await connection.execute(`
        ALTER TABLE travel_insurance_quotes 
        ADD COLUMN traveler_email VARCHAR(255) NULL
      `);
      console.log('✅ Added traveler_email column to travel_insurance_quotes table');
    } else {
      console.log('ℹ️  traveler_email column already exists in travel_insurance_quotes table');
    }

    // Also add owner_name fields for consistency
    if (!(await columnExists('car_insurance_quotes', 'car_owner_name'))) {
      await connection.execute(`
        ALTER TABLE car_insurance_quotes 
        ADD COLUMN car_owner_name VARCHAR(255) NULL
      `);
      console.log('✅ Added car_owner_name column to car_insurance_quotes table');
    } else {
      console.log('ℹ️  car_owner_name column already exists in car_insurance_quotes table');
    }

    if (!(await columnExists('car_insurance_quotes', 'car_owner_telephone'))) {
      await connection.execute(`
        ALTER TABLE car_insurance_quotes 
        ADD COLUMN car_owner_telephone VARCHAR(20) NULL
      `);
      console.log('✅ Added car_owner_telephone column to car_insurance_quotes table');
    } else {
      console.log('ℹ️  car_owner_telephone column already exists in car_insurance_quotes table');
    }

    if (!(await columnExists('travel_insurance_quotes', 'traveler_name'))) {
      await connection.execute(`
        ALTER TABLE travel_insurance_quotes 
        ADD COLUMN traveler_name VARCHAR(255) NULL
      `);
      console.log('✅ Added traveler_name column to travel_insurance_quotes table');
    } else {
      console.log('ℹ️  traveler_name column already exists in travel_insurance_quotes table');
    }

    if (!(await columnExists('travel_insurance_quotes', 'traveler_telephone'))) {
      await connection.execute(`
        ALTER TABLE travel_insurance_quotes 
        ADD COLUMN traveler_telephone VARCHAR(20) NULL
      `);
      console.log('✅ Added traveler_telephone column to travel_insurance_quotes table');
    } else {
      console.log('ℹ️  traveler_telephone column already exists in travel_insurance_quotes table');
    }

    console.log('✅ Email fields migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

addEmailFields();