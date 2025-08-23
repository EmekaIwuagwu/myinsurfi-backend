const { connectDB } = require('../config/database');

const createAnalyticsTables = async () => {
  const connection = await connectDB();

  try {
    console.log('Creating analytics tables...');

    // Platform Analytics Table for storing metrics
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

    console.log('✅ Analytics tables created successfully!');
    
    // Insert some sample analytics data
    await insertSampleData(connection);
    
    console.log('✅ Sample data inserted!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

const insertSampleData = async (connection) => {
  try {
    console.log('Inserting sample analytics data...');

    // Insert daily views for the last 30 days
    const today = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const views = Math.floor(Math.random() * 2000) + 1000;
      
      await connection.execute(`
        INSERT IGNORE INTO platform_analytics (date, metric_type, metric_value) 
        VALUES (?, 'daily_views', ?)
      `, [dateStr, views]);
    }

    console.log('Sample analytics data inserted successfully!');
  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
};

createAnalyticsTables();