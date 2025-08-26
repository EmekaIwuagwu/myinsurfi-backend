const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using your SMTP configuration
const createTransporter = () => {
  return nodemailer.createTransport({ // FIXED: Changed from createTransporter to createTransport
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates if needed
    }
  });
};

// Send email with PDF attachment
const sendPolicyEmail = async (to, policyData, pdfBuffer, policyType) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"MyInsurFi" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Your ${policyType} Insurance Policy - ${policyData.policy_number}`,
      html: generatePolicyEmailTemplate(policyData, policyType),
      attachments: [
        {
          filename: `${policyData.policy_number}_${policyType}_Policy.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Policy email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending policy email:', error);
    throw error;
  }
};

// Send claim update email
const sendClaimUpdateEmail = async (to, claimData, status) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"MyInsurFi Claims" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Claim Update - ${claimData.claim_id}`,
      html: generateClaimEmailTemplate(claimData, status)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Claim email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending claim email:', error);
    throw error;
  }
};

// Generate email template for policy
const generatePolicyEmailTemplate = (policyData, policyType) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .policy-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .highlight { color: #667eea; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛡️ Your Insurance Policy is Ready!</h1>
          <p>Policy Number: <strong>${policyData.policy_number}</strong></p>
        </div>
        
        <div class="content">
          <h2>Congratulations! Your ${policyType} insurance is now active.</h2>
          
          <div class="policy-details">
            <h3>Policy Details:</h3>
            <p><strong>Policy Type:</strong> ${policyType.charAt(0).toUpperCase() + policyType.slice(1)} Insurance</p>
            <p><strong>Policy Number:</strong> ${policyData.policy_number}</p>
            <p><strong>Coverage Amount:</strong> ${policyData.formatted_coverage || 'N/A'}</p>
            <p><strong>Premium:</strong> ${policyData.formatted_premium || 'N/A'}</p>
            <p><strong>Policy Start:</strong> ${new Date(policyData.policy_start_date).toLocaleDateString()}</p>
            <p><strong>Policy End:</strong> ${new Date(policyData.policy_end_date).toLocaleDateString()}</p>
          </div>
          
          <p>📎 <strong>Your complete policy document is attached to this email as a PDF.</strong></p>
          
          <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Next Steps:</h3>
            <ul>
              <li>Save your policy document in a secure location</li>
              <li>Review your coverage details carefully</li>
              <li>Contact us if you have any questions</li>
              <li>Keep your policy number handy for any future claims</li>
            </ul>
          </div>
          
          <p>Thank you for choosing MyInsurFi for your insurance needs!</p>
        </div>
        
        <div class="footer">
          <p>MyInsurFi - Decentralized Insurance Platform<br>
          This email was sent from an automated system. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generate email template for claims
const generateClaimEmailTemplate = (claimData, status) => {
  const statusColors = {
    approved: '#28a745',
    rejected: '#dc3545',
    processing_payment: '#ffc107',
    paid: '#17a2b8'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .status-badge { 
          background: ${statusColors[status] || '#6c757d'}; 
          color: white; 
          padding: 10px 20px; 
          border-radius: 25px; 
          display: inline-block; 
          font-weight: bold;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Claim Update</h1>
          <p>Claim ID: <strong>${claimData.claim_id}</strong></p>
        </div>
        
        <div class="content">
          <div style="text-align: center; margin: 20px 0;">
            <span class="status-badge">${status.replace('_', ' ')}</span>
          </div>
          
          <h3>Claim Details:</h3>
          <p><strong>Claim Amount:</strong> $${parseFloat(claimData.claim_amount).toLocaleString()}</p>
          <p><strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</p>
          <p><strong>Submitted:</strong> ${new Date(claimData.created_at).toLocaleDateString()}</p>
          
          ${claimData.payout_amount ? `<p><strong>Payout Amount:</strong> $${parseFloat(claimData.payout_amount).toLocaleString()}</p>` : ''}
          ${claimData.admin_notes ? `<p><strong>Notes:</strong> ${claimData.admin_notes}</p>` : ''}
          
          <p>Please log in to your MyInsurFi dashboard for more details.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  sendPolicyEmail,
  sendClaimUpdateEmail,
  createTransporter
};