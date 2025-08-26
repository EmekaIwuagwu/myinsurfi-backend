const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Color constants
const COLORS = {
  primary: rgb(0.4, 0.498, 0.918), // #667eea
  secondary: rgb(0.463, 0.294, 0.635), // #764ba2
  dark: rgb(0.2, 0.2, 0.2),
  gray: rgb(0.5, 0.5, 0.5),
  lightGray: rgb(0.9, 0.9, 0.9),
  white: rgb(1, 1, 1),
  success: rgb(0.157, 0.635, 0.271), // #28a745
  black: rgb(0, 0, 0)
};

// Generate PDF for Home Insurance Policy
const generateHomeInsurancePDF = async (policyData) => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = height - 50;
    
    // Header with gradient effect (simulated with rectangles)
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: COLORS.primary,
    });
    
    // Company Logo Area (text-based)
    page.drawText('🏠 MyInsurFi', {
      x: 50,
      y: height - 60,
      size: 24,
      font: boldFont,
      color: COLORS.white,
    });
    
    page.drawText('Decentralized Insurance Platform', {
      x: 50,
      y: height - 85,
      size: 12,
      font: font,
      color: COLORS.white,
    });
    
    // Policy Title
    page.drawText('HOME INSURANCE POLICY', {
      x: width - 280,
      y: height - 60,
      size: 18,
      font: boldFont,
      color: COLORS.white,
    });
    
    // Policy Number
    const policyNumber = `HI-${new Date().getFullYear()}-${policyData.id}`;
    page.drawText(`Policy No: ${policyNumber}`, {
      x: width - 280,
      y: height - 85,
      size: 12,
      font: boldFont,
      color: COLORS.white,
    });
    
    yPosition = height - 140;
    
    // Policy Status Badge
    const statusBadgeWidth = 100;
    page.drawRectangle({
      x: width - 150,
      y: yPosition - 25,
      width: statusBadgeWidth,
      height: 25,
      color: COLORS.success,
    });
    
    page.drawText('ACTIVE', {
      x: width - 125,
      y: yPosition - 18,
      size: 12,
      font: boldFont,
      color: COLORS.white,
    });
    
    yPosition -= 60;
    
    // Policy Information Section
    drawSectionHeader(page, 'POLICY INFORMATION', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    // Two-column layout for policy info
    const leftColumn = 70;
    const rightColumn = 320;
    
    yPosition = drawPolicyField(page, 'Policy Holder:', policyData.property_owner_name || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Issue Date:', new Date().toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Email:', policyData.property_owner_email || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Policy Start:', new Date(policyData.policy_start_date).toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Phone:', policyData.property_owner_telephone || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Policy End:', new Date(policyData.policy_end_date).toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition -= 40;
    
    // Property Details Section
    drawSectionHeader(page, 'PROPERTY DETAILS', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    yPosition = drawPolicyField(page, 'Property Type:', policyData.house_type || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Year Built:', policyData.year_built?.toString() || 'N/A', rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPropertyAddress(page, 'Property Address:', policyData.house_address || 'N/A', leftColumn, yPosition, font, boldFont);
    
    yPosition -= 40;
    
    // Coverage Details Section
    drawSectionHeader(page, 'COVERAGE DETAILS', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    // Coverage table
    const coverageData = [
      ['Coverage Type', 'Coverage Amount', 'Deductible'],
      ['Dwelling Coverage', formatCurrency(policyData.coverage_amount) || '$250,000', '$2,500'],
      ['Personal Property', formatCurrency(policyData.coverage_amount * 0.5) || '$125,000', '$1,000'],
      ['Liability Coverage', '$100,000', '$0'],
      ['Additional Living Expenses', '$50,000', '$500']
    ];
    
    yPosition = drawTable(page, coverageData, 50, yPosition, font, boldFont);
    
    yPosition -= 40;
    
    // Premium Information
    drawSectionHeader(page, 'PREMIUM INFORMATION', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    yPosition = drawPolicyField(page, 'Annual Premium:', formatCurrency(policyData.total_premium) || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Payment Frequency:', 'Annual', rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Coverage Duration:', `${policyData.coverage_duration || 12} months`, leftColumn, yPosition, font, boldFont);
    
    // Footer
    drawFooter(page, width, font);
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('Error generating home insurance PDF:', error);
    throw error;
  }
};

// Generate PDF for Car Insurance Policy
const generateCarInsurancePDF = async (policyData) => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = height - 50;
    
    // Header
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: COLORS.primary,
    });
    
    page.drawText('🚗 MyInsurFi', {
      x: 50,
      y: height - 60,
      size: 24,
      font: boldFont,
      color: COLORS.white,
    });
    
    page.drawText('AUTO INSURANCE POLICY', {
      x: width - 250,
      y: height - 60,
      size: 18,
      font: boldFont,
      color: COLORS.white,
    });
    
    const policyNumber = `CI-${new Date().getFullYear()}-${policyData.id}`;
    page.drawText(`Policy No: ${policyNumber}`, {
      x: width - 250,
      y: height - 85,
      size: 12,
      font: boldFont,
      color: COLORS.white,
    });
    
    yPosition = height - 140;
    
    // Status Badge
    const statusBadgeWidth = 100;
    page.drawRectangle({
      x: width - 150,
      y: yPosition - 25,
      width: statusBadgeWidth,
      height: 25,
      color: COLORS.success,
    });
    
    page.drawText('ACTIVE', {
      x: width - 125,
      y: yPosition - 18,
      size: 12,
      font: boldFont,
      color: COLORS.white,
    });
    
    yPosition -= 60;
    
    // Policy Information
    drawSectionHeader(page, 'POLICY INFORMATION', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    const leftColumn = 70;
    const rightColumn = 320;
    
    // Generate name from wallet address (you can customize this)
    const customerName = generateNameFromWallet(policyData.wallet_address);
    
    yPosition = drawPolicyField(page, 'Policy Holder:', customerName, leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Issue Date:', new Date().toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Wallet Address:', shortenWallet(policyData.wallet_address), leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Policy Start:', new Date(policyData.policy_start_date).toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Duration:', `${policyData.coverage_duration || 12} months`, leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Policy End:', new Date(policyData.policy_end_date).toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition -= 40;
    
    // Vehicle Details
    drawSectionHeader(page, 'VEHICLE DETAILS', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    yPosition = drawPolicyField(page, 'Make:', policyData.car_make || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Model:', policyData.car_model || 'N/A', rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Year:', policyData.car_year?.toString() || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Mileage:', `${policyData.mileage?.toLocaleString() || 'N/A'} miles`, rightColumn, yPosition + 20, font, boldFont);
    
    yPosition -= 40;
    
    // Coverage Details
    drawSectionHeader(page, 'COVERAGE DETAILS', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    const coverageAmount = policyData.coverage_amount || 50000;
    const coverageData = [
      ['Coverage Type', 'Coverage Amount', 'Deductible'],
      ['Liability Coverage', '$100,000', '$0'],
      ['Collision Coverage', formatCurrency(coverageAmount), '$1,000'],
      ['Comprehensive Coverage', formatCurrency(coverageAmount * 0.8), '$500'],
      ['Uninsured Motorist', '$50,000', '$0']
    ];
    
    yPosition = drawTable(page, coverageData, 50, yPosition, font, boldFont);
    
    yPosition -= 40;
    
    // Premium Information
    drawSectionHeader(page, 'PREMIUM INFORMATION', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    const annualPremium = policyData.total_premium || 1200;
    yPosition = drawPolicyField(page, 'Annual Premium:', formatCurrency(annualPremium), leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Monthly Premium:', formatCurrency(annualPremium / 12), rightColumn, yPosition + 20, font, boldFont);
    
    drawFooter(page, width, font);
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('Error generating car insurance PDF:', error);
    throw error;
  }
};

// Generate PDF for Travel Insurance Policy
const generateTravelInsurancePDF = async (policyData) => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = height - 50;
    
    // Header
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: COLORS.primary,
    });
    
    page.drawText('✈️ MyInsurFi', {
      x: 50,
      y: height - 60,
      size: 24,
      font: boldFont,
      color: COLORS.white,
    });
    
    page.drawText('TRAVEL INSURANCE POLICY', {
      x: width - 280,
      y: height - 60,
      size: 18,
      font: boldFont,
      color: COLORS.white,
    });
    
    const policyNumber = `TI-${new Date().getFullYear()}-${policyData.id}`;
    page.drawText(`Policy No: ${policyNumber}`, {
      x: width - 280,
      y: height - 85,
      size: 12,
      font: boldFont,
      color: COLORS.white,
    });
    
    yPosition = height - 140;
    
    // Status Badge
    const statusBadgeWidth = 100;
    page.drawRectangle({
      x: width - 150,
      y: yPosition - 25,
      width: statusBadgeWidth,
      height: 25,
      color: COLORS.success,
    });
    
    page.drawText('ACTIVE', {
      x: width - 125,
      y: yPosition - 18,
      size: 12,
      font: boldFont,
      color: COLORS.white,
    });
    
    yPosition -= 60;
    
    // Policy Information
    drawSectionHeader(page, 'POLICY INFORMATION', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    const leftColumn = 70;
    const rightColumn = 320;
    
    const customerName = generateNameFromWallet(policyData.wallet_address);
    
    yPosition = drawPolicyField(page, 'Policy Holder:', customerName, leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Issue Date:', new Date().toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Passport Number:', policyData.passport_number || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Travel Start:', new Date(policyData.travel_start_date).toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Passport Country:', policyData.passport_country || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Travel End:', new Date(policyData.travel_end_date).toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition -= 40;
    
    // Trip Details
    drawSectionHeader(page, 'TRIP DETAILS', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    yPosition = drawPolicyField(page, 'Origin:', policyData.origin || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Departure Date:', new Date(policyData.departure).toLocaleDateString(), rightColumn, yPosition + 20, font, boldFont);
    
    yPosition = drawPolicyField(page, 'Destination:', policyData.destination || 'N/A', leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Duration:', `${policyData.coverage_duration || calculateTripDuration(policyData)} days`, rightColumn, yPosition + 20, font, boldFont);
    
    yPosition -= 40;
    
    // Coverage Details
    drawSectionHeader(page, 'COVERAGE DETAILS', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    const coverageAmount = policyData.coverage_amount || 25000;
    const coverageData = [
      ['Coverage Type', 'Coverage Amount', 'Deductible'],
      ['Medical Expenses', formatCurrency(coverageAmount), '$250'],
      ['Trip Cancellation', formatCurrency(coverageAmount * 0.8), '$500'],
      ['Baggage Coverage', '$5,000', '$100'],
      ['Emergency Evacuation', '$100,000', '$0']
    ];
    
    yPosition = drawTable(page, coverageData, 50, yPosition, font, boldFont);
    
    yPosition -= 40;
    
    // Premium Information
    drawSectionHeader(page, 'PREMIUM INFORMATION', 50, yPosition, boldFont, COLORS.primary);
    yPosition -= 30;
    
    const totalPremium = policyData.total_premium || 300;
    yPosition = drawPolicyField(page, 'Total Premium:', formatCurrency(totalPremium), leftColumn, yPosition, font, boldFont);
    drawPolicyField(page, 'Coverage Period:', `${policyData.coverage_duration || calculateTripDuration(policyData)} days`, rightColumn, yPosition + 20, font, boldFont);
    
    drawFooter(page, width, font);
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error('Error generating travel insurance PDF:', error);
    throw error;
  }
};

// Helper Functions
function drawSectionHeader(page, title, x, y, font, color) {
  page.drawText(title, {
    x,
    y,
    size: 14,
    font,
    color,
  });
  
  // Underline
  page.drawLine({
    start: { x, y: y - 5 },
    end: { x: x + 200, y: y - 5 },
    thickness: 2,
    color,
  });
}

function drawPolicyField(page, label, value, x, y, font, boldFont) {
  page.drawText(label, {
    x,
    y,
    size: 10,
    font: boldFont,
    color: COLORS.dark,
  });
  
  page.drawText(value, {
    x,
    y: y - 15,
    size: 10,
    font,
    color: COLORS.black,
  });
  
  return y - 35;
}

function drawPropertyAddress(page, label, address, x, y, font, boldFont) {
  page.drawText(label, {
    x,
    y,
    size: 10,
    font: boldFont,
    color: COLORS.dark,
  });
  
  // Handle long addresses by wrapping text
  const maxWidth = 200;
  const words = address.split(' ');
  let currentLine = '';
  let lineY = y - 15;
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const textWidth = testLine.length * 6; // Approximate width
    
    if (textWidth > maxWidth && currentLine) {
      page.drawText(currentLine, {
        x,
        y: lineY,
        size: 10,
        font,
        color: COLORS.black,
      });
      currentLine = word;
      lineY -= 15;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    page.drawText(currentLine, {
      x,
      y: lineY,
      size: 10,
      font,
      color: COLORS.black,
    });
  }
  
  return lineY - 20;
}

function drawTable(page, data, x, startY, font, boldFont) {
  const rowHeight = 25;
  const colWidths = [180, 120, 100];
  let currentY = startY;
  
  data.forEach((row, rowIndex) => {
    let currentX = x;
    
    // Draw row background for header
    if (rowIndex === 0) {
      page.drawRectangle({
        x: x - 5,
        y: currentY - rowHeight + 5,
        width: colWidths.reduce((a, b) => a + b, 0) + 10,
        height: rowHeight,
        color: COLORS.lightGray,
      });
    }
    
    row.forEach((cell, colIndex) => {
      page.drawText(cell, {
        x: currentX + 10,
        y: currentY - 15,
        size: 9,
        font: rowIndex === 0 ? boldFont : font,
        color: COLORS.black,
      });
      
      // Draw vertical lines
      if (colIndex < row.length - 1) {
        page.drawLine({
          start: { x: currentX + colWidths[colIndex], y: currentY },
          end: { x: currentX + colWidths[colIndex], y: currentY - rowHeight },
          thickness: 0.5,
          color: COLORS.gray,
        });
      }
      
      currentX += colWidths[colIndex];
    });
    
    // Draw horizontal line
    page.drawLine({
      start: { x: x - 5, y: currentY - rowHeight + 5 },
      end: { x: x + colWidths.reduce((a, b) => a + b, 0) + 5, y: currentY - rowHeight + 5 },
      thickness: 0.5,
      color: COLORS.gray,
    });
    
    currentY -= rowHeight;
  });
  
  return currentY;
}

function drawFooter(page, width, font) {
  const footerY = 50;
  
  page.drawLine({
    start: { x: 50, y: footerY + 30 },
    end: { x: width - 50, y: footerY + 30 },
    thickness: 1,
    color: COLORS.gray,
  });
  
  page.drawText('MyInsurFi - Decentralized Insurance Platform', {
    x: 50,
    y: footerY + 10,
    size: 8,
    font,
    color: COLORS.gray,
  });
  
  page.drawText(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, {
    x: width - 200,
    y: footerY + 10,
    size: 8,
    font,
    color: COLORS.gray,
  });
  
  page.drawText('This is a computer-generated document. No signature is required.', {
    x: 50,
    y: footerY - 10,
    size: 8,
    font,
    color: COLORS.gray,
  });
}

// Utility Functions
function formatCurrency(amount) {
  if (!amount) return '$0';
  return `$${parseFloat(amount).toLocaleString('en-US')}`;
}

function generateNameFromWallet(walletAddress) {
  const names = ['John Smith', 'Jane Doe', 'Bob Johnson', 'Alice Wilson', 'Mike Davis'];
  const index = parseInt(walletAddress.slice(-1), 16) % names.length;
  return names[index];
}

function shortenWallet(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function calculateTripDuration(policyData) {
  const start = new Date(policyData.travel_start_date);
  const end = new Date(policyData.travel_end_date);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  generateHomeInsurancePDF,
  generateCarInsurancePDF,
  generateTravelInsurancePDF,
  formatCurrency,
  generateNameFromWallet
};