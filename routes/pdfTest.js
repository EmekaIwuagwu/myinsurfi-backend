const express = require('express');
const router = express.Router();
const {
  generateHomeInsurancePDF,
  generateCarInsurancePDF,
  generateTravelInsurancePDF
} = require('../services/pdfService');
const { sendPolicyEmail } = require('../services/emailService');

// Test PDF Generation (without email)
router.get('/test-pdf/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    // Mock policy data for testing
    const mockData = {
      home: {
        id: 1,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        house_type: 'Single Family Home',
        year_built: 2015,
        house_address: '123 Main Street, Anytown, ST 12345',
        property_owner_name: 'John Doe',
        property_owner_telephone: '+1 (555) 123-4567',
        property_owner_email: 'john.doe@example.com',
        policy_start_date: new Date(),
        policy_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        coverage_duration: 12,
        coverage_amount: 250000,
        total_premium: 1200,
        policy_number: 'HI-2024-001'
      },
      car: {
        id: 2,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        car_make: 'Toyota',
        car_model: 'Camry',
        car_year: 2022,
        mileage: 25000,
        policy_start_date: new Date(),
        policy_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        coverage_duration: 12,
        coverage_amount: 50000,
        total_premium: 1200,
        policy_number: 'CI-2024-002'
      },
      travel: {
        id: 3,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        origin: 'New York, NY',
        departure: new Date(),
        destination: 'Paris, France',
        passport_number: 'ABC123456',
        passport_country: 'United States',
        travel_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        travel_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        coverage_duration: 7,
        coverage_amount: 25000,
        total_premium: 300,
        policy_number: 'TI-2024-003'
      }
    };

    if (!mockData[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid policy type. Use: home, car, or travel'
      });
    }

    let pdfBuffer;
    
    switch (type) {
      case 'home':
        pdfBuffer = await generateHomeInsurancePDF(mockData.home);
        break;
      case 'car':
        pdfBuffer = await generateCarInsurancePDF(mockData.car);
        break;
      case 'travel':
        pdfBuffer = await generateTravelInsurancePDF(mockData.travel);
        break;
    }

    // Set headers to download PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-insurance-policy-test.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
});

// Test PDF Generation + Email Sending
router.post('/test-email/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required in request body'
      });
    }

    // Mock policy data for testing
    const mockData = {
      home: {
        id: 1,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        house_type: 'Single Family Home',
        year_built: 2015,
        house_address: '123 Main Street, Anytown, ST 12345',
        property_owner_name: 'John Doe',
        property_owner_telephone: '+1 (555) 123-4567',
        property_owner_email: email,
        policy_start_date: new Date(),
        policy_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        coverage_duration: 12,
        coverage_amount: 250000,
        total_premium: 1200,
        policy_number: 'HI-2024-TEST-001',
        formatted_coverage: '$250,000',
        formatted_premium: '$1,200',
        customer_name: 'John Doe',
        customer_email: email
      },
      car: {
        id: 2,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        car_make: 'Toyota',
        car_model: 'Camry',
        car_year: 2022,
        mileage: 25000,
        policy_start_date: new Date(),
        policy_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        coverage_duration: 12,
        coverage_amount: 50000,
        total_premium: 1200,
        policy_number: 'CI-2024-TEST-002',
        formatted_coverage: '$50,000',
        formatted_premium: '$1,200',
        customer_name: 'John Doe',
        customer_email: email
      },
      travel: {
        id: 3,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        origin: 'New York, NY',
        departure: new Date(),
        destination: 'Paris, France',
        passport_number: 'ABC123456',
        passport_country: 'United States',
        travel_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        travel_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        coverage_duration: 7,
        coverage_amount: 25000,
        total_premium: 300,
        policy_number: 'TI-2024-TEST-003',
        formatted_coverage: '$25,000',
        formatted_premium: '$300',
        customer_name: 'John Doe',
        customer_email: email
      }
    };

    if (!mockData[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid policy type. Use: home, car, or travel'
      });
    }

    console.log(`🔄 Generating test ${type} insurance PDF...`);
    
    let pdfBuffer;
    
    switch (type) {
      case 'home':
        pdfBuffer = await generateHomeInsurancePDF(mockData.home);
        break;
      case 'car':
        pdfBuffer = await generateCarInsurancePDF(mockData.car);
        break;
      case 'travel':
        pdfBuffer = await generateTravelInsurancePDF(mockData.travel);
        break;
    }

    console.log(`✅ PDF generated successfully`);
    console.log(`📧 Sending test email to: ${email}`);

    await sendPolicyEmail(
      email,
      mockData[type],
      pdfBuffer,
      type
    );

    console.log(`✅ Test email sent successfully!`);

    res.json({
      success: true,
      message: `Test ${type} insurance policy PDF generated and sent to ${email}`,
      data: {
        policy_type: type,
        email_sent_to: email,
        policy_number: mockData[type].policy_number
      }
    });

  } catch (error) {
    console.error('PDF + Email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF or sending email',
      error: error.message
    });
  }
});

// Test Email Service Configuration
router.get('/test-smtp', async (req, res) => {
  try {
    const { createTransporter } = require('../services/emailService');
    const transporter = createTransporter();
    
    // Verify SMTP connection
    await transporter.verify();
    
    res.json({
      success: true,
      message: 'SMTP configuration is valid and connection successful',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'SMTP configuration error',
      error: error.message,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER
      }
    });
  }
});

module.exports = router;