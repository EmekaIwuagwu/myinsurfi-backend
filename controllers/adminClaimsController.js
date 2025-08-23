const { getConnection } = require('../config/database');

// Get All Claims
const getAllClaims = async (req, res) => {
    try {
        console.log('=== DEBUG: Starting getAllClaims ===');
        console.log('Raw query params:', req.query);

        const {
            page = 1,
            limit = 10,
            status = 'all',
            policy_type = 'all',
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        console.log('Parsed params:', { page, limit, status, policy_type, sortBy, sortOrder });

        const connection = getConnection();
        
        // Validate and convert numbers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offsetNum = (pageNum - 1) * limitNum;
        
        console.log('Calculated numbers:', { pageNum, limitNum, offsetNum });
        console.log('Are numbers valid?', { 
            pageValid: !isNaN(pageNum), 
            limitValid: !isNaN(limitNum), 
            offsetValid: !isNaN(offsetNum) 
        });

        // Build filters
        let statusFilter = '';
        let typeFilter = '';
        let queryParams = [];

        if (status !== 'all') {
            statusFilter = 'AND c.status = ?';
            queryParams.push(status);
        }

        if (policy_type !== 'all') {
            typeFilter = 'AND c.policy_type = ?';
            queryParams.push(policy_type);
        }

        console.log('Filters:', { statusFilter, typeFilter, queryParams });

        // SIMPLE TEST QUERY FIRST - let's see if basic query works
        console.log('=== Testing basic query first ===');
        try {
            const [basicTest] = await connection.execute(`
                SELECT COUNT(*) as total FROM insurance_claims
            `);
            console.log('Basic query success:', basicTest);
        } catch (basicError) {
            console.error('Basic query failed:', basicError);
            throw basicError;
        }

        // Now try with parameters
        const finalParams = [...queryParams, limitNum, offsetNum];
        console.log('Final parameters array:', finalParams);
        console.log('Parameter types:', finalParams.map(p => typeof p));
        console.log('Parameter values:', finalParams);

        const query = `
            SELECT 
                c.*,
                a.name as reviewed_by_name
            FROM insurance_claims c
            LEFT JOIN admin_users a ON c.reviewed_by = a.id
            WHERE 1=1 ${statusFilter} ${typeFilter}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;

        console.log('Final query:', query);
        console.log('About to execute with params:', finalParams);

        const [claims] = await connection.execute(query, finalParams);

        console.log('Query executed successfully, got claims:', claims.length);

        // Simple response for now
        res.json({
            success: true,
            debug: {
                queryParams: finalParams,
                queryParamTypes: finalParams.map(p => typeof p),
                claimsFound: claims.length
            },
            data: {
                claims: claims.slice(0, 5), // Just first 5 for debugging
                pagination: {
                    current_page: pageNum,
                    per_page: limitNum,
                    total_claims: claims.length
                }
            }
        });

    } catch (error) {
        console.error('=== DETAILED ERROR DEBUG ===');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error errno:', error.errno);
        console.error('SQL State:', error.sqlState);
        console.error('SQL Message:', error.sqlMessage);
        console.error('Full error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
            debug: {
                code: error.code,
                errno: error.errno,
                sqlState: error.sqlState,
                sqlMessage: error.sqlMessage
            }
        });
    }
};
// Get Claim Details
const getClaimDetails = async (req, res) => {
    try {
        const { claim_id } = req.params;

        if (!claim_id) {
            return res.status(400).json({
                success: false,
                message: 'Claim ID is required'
            });
        }

        const connection = getConnection();

        // Get claim details
        const [claims] = await connection.execute(`
      SELECT 
        c.*,
        a.name as reviewed_by_name,
        a.email as reviewed_by_email
      FROM insurance_claims c
      LEFT JOIN admin_users a ON c.reviewed_by = a.id
      WHERE c.claim_id = ?
    `, [claim_id]);

        if (claims.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Claim not found'
            });
        }

        const claim = claims[0];

        // NEW: Get claim documents for admin viewing
        const [documents] = await connection.execute(`
      SELECT 
        id,
        document_type,
        file_name,
        file_data,
        file_size,
        mime_type,
        created_at
      FROM claim_documents
      WHERE claim_id = ?
      ORDER BY created_at ASC
    `, [claim_id]);

        // Get related policy details based on policy type
        let policyDetails = null;

        if (claim.policy_type === 'home') {
            const [policies] = await connection.execute(`
        SELECT 
          house_type,
          house_address,
          property_owner_name,
          property_owner_email,
          property_owner_telephone,
          coverage_amount,
          total_premium,
          policy_start_date,
          policy_end_date
        FROM home_insurance_quotes
        WHERE id = ?
      `, [claim.policy_id]);
            policyDetails = policies[0];
        } else if (claim.policy_type === 'car') {
            const [policies] = await connection.execute(`
        SELECT 
          car_make,
          car_model,
          car_year,
          policy_start_date,
          policy_end_date
        FROM car_insurance_quotes
        WHERE id = ?
      `, [claim.policy_id]);
            policyDetails = policies[0];
        } else if (claim.policy_type === 'travel') {
            const [policies] = await connection.execute(`
        SELECT 
          origin,
          destination,
          travel_start_date,
          travel_end_date
        FROM travel_insurance_quotes
        WHERE id = ?
      `, [claim.policy_id]);
            policyDetails = policies[0];
        }

        // Enhance with customer info
        const { generateNameFromWallet, generateEmailFromWallet } = require('./adminUserController');

        const enhancedClaim = {
            ...claim,
            customer: generateNameFromWallet(claim.wallet_address),
            customer_email: generateEmailFromWallet(claim.wallet_address),
            formatted_wallet: `${claim.wallet_address.slice(0, 6)}...${claim.wallet_address.slice(-4)}`,
            formatted_amount: parseFloat(claim.claim_amount).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD'
            }),
            policy_details: policyDetails,
            // NEW: Add documents with admin-friendly properties
            documents: documents.map(doc => ({
                id: doc.id,
                document_type: doc.document_type,
                file_name: doc.file_name,
                file_size: doc.file_size,
                mime_type: doc.mime_type,
                created_at: doc.created_at,
                // Include base64 data for admin viewing
                file_data: doc.file_data,
                // Helper properties for frontend display
                is_image: doc.mime_type?.startsWith('image/'),
                is_pdf: doc.mime_type === 'application/pdf',
                is_document: !doc.mime_type?.startsWith('image/') && doc.mime_type !== 'application/pdf',
                // Download URL for admin frontend
                download_url: `data:${doc.mime_type};base64,${doc.file_data}`,
                // Formatted file size for display
                formatted_size: `${(doc.file_size / 1024).toFixed(1)} KB`
            }))
        };

        res.json({
            success: true,
            data: enhancedClaim
        });
    } catch (error) {
        console.error('Get claim details error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update Claim Status
const updateClaimStatus = async (req, res) => {
    try {
        const { claim_id } = req.params;
        const { status, admin_notes, payout_amount } = req.body;

        if (!claim_id || !status) {
            return res.status(400).json({
                success: false,
                message: 'Claim ID and status are required'
            });
        }

        if (!['approved', 'rejected', 'processing_payment', 'paid'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const connection = getConnection();

        // Update claim
        const updateData = [status, req.admin.admin_id, admin_notes];
        let updateQuery = `
      UPDATE insurance_claims 
      SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ?
    `;

        if (payout_amount && ['approved', 'processing_payment', 'paid'].includes(status)) {
            updateQuery += ', payout_amount = ?';
            updateData.push(payout_amount);
        }

        if (status === 'paid') {
            updateQuery += ', payout_date = NOW()';
        }

        updateQuery += ' WHERE claim_id = ?';
        updateData.push(claim_id);

        await connection.execute(updateQuery, updateData);

        // Get claim details for notification
        const [claimData] = await connection.execute(`
      SELECT wallet_address, description FROM insurance_claims WHERE claim_id = ?
    `, [claim_id]);

        if (claimData.length > 0) {
            // Create notification for user
            let notificationMessage = '';
            switch (status) {
                case 'approved':
                    notificationMessage = `Your claim ${claim_id} has been approved${payout_amount ? ` for $${payout_amount}` : ''}.`;
                    break;
                case 'rejected':
                    notificationMessage = `Your claim ${claim_id} has been rejected. ${admin_notes || ''}`;
                    break;
                case 'processing_payment':
                    notificationMessage = `Your claim ${claim_id} is being processed for payment.`;
                    break;
                case 'paid':
                    notificationMessage = `Your claim ${claim_id} has been paid${payout_amount ? ` ($${payout_amount})` : ''}.`;
                    break;
            }

            await connection.execute(`
        INSERT INTO notifications (wallet_address, type, title, message)
        VALUES (?, ?, ?, ?)
      `, [
                claimData[0].wallet_address,
                'claim_update',
                `Claim ${status}`,
                notificationMessage
            ]);
        }

        // Log admin activity
        await connection.execute(`
      INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
            req.admin.admin_id,
            'update_claim_status',
            'claim',
            claim_id,
            JSON.stringify({ status, admin_notes, payout_amount })
        ]);

        res.json({
            success: true,
            message: `Claim ${status} successfully`
        });
    } catch (error) {
        console.error('Update claim status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Process Claim Payment
const processClaimPayment = async (req, res) => {
    try {
        const { claim_id } = req.params;
        const { payout_amount, payment_method, transaction_hash } = req.body;

        if (!claim_id || !payout_amount) {
            return res.status(400).json({
                success: false,
                message: 'Claim ID and payout amount are required'
            });
        }

        const connection = getConnection();

        // Check if claim is approved
        const [claims] = await connection.execute(`
      SELECT * FROM insurance_claims WHERE claim_id = ? AND status IN ('approved', 'processing_payment')
    `, [claim_id]);

        if (claims.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Claim not found or not approved'
            });
        }

        // Update claim to paid status
        await connection.execute(`
      UPDATE insurance_claims 
      SET status = 'paid', payout_amount = ?, payout_date = NOW(), reviewed_by = ?
      WHERE claim_id = ?
    `, [payout_amount, req.admin.admin_id, claim_id]);

        // Create notification for user
        await connection.execute(`
      INSERT INTO notifications (wallet_address, type, title, message)
      VALUES (?, ?, ?, ?)
    `, [
            claims[0].wallet_address,
            'payment_processed',
            'Payment Processed',
            `Your claim ${claim_id} has been paid. Amount: $${payout_amount}`
        ]);

        // Log admin activity
        await connection.execute(`
      INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
            req.admin.admin_id,
            'process_payment',
            'claim',
            claim_id,
            JSON.stringify({ payout_amount, payment_method, transaction_hash })
        ]);

        res.json({
            success: true,
            message: 'Payment processed successfully'
        });
    } catch (error) {
        console.error('Process claim payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get Claims Statistics
const getClaimsStatistics = async (req, res) => {
    try {
        const connection = getConnection();

        // Get counts by status
        const [statusStats] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(claim_amount) as total_amount,
        AVG(claim_amount) as avg_amount
      FROM insurance_claims
      GROUP BY status
    `);

        // Get counts by policy type
        const [typeStats] = await connection.execute(`
      SELECT 
        policy_type,
        COUNT(*) as count,
        SUM(claim_amount) as total_amount
      FROM insurance_claims
      GROUP BY policy_type
    `);

        // Get monthly trends
        const [monthlyStats] = await connection.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as claims_count,
        SUM(claim_amount) as total_amount,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'paid' THEN payout_amount ELSE 0 END) as total_paid
      FROM insurance_claims
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);

        res.json({
            success: true,
            data: {
                by_status: statusStats,
                by_type: typeStats,
                monthly_trends: monthlyStats
            }
        });
    } catch (error) {
        console.error('Get claims statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getAllClaims,
    getClaimDetails,
    updateClaimStatus,
    processClaimPayment,
    getClaimsStatistics
};