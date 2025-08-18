const { getConnection } = require('../config/database');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 10 // Max 10 files
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
        }
    }
});

// Submit Insurance Claim with File Upload
const submitClaimWithFiles = [
    upload.array('documents', 10), // Handle up to 10 files with field name 'documents'
    async (req, res) => {
        try {
            const {
                wallet_address,
                policy_type,
                policy_id,
                claim_amount,
                description,
                incident_date
            } = req.body;

            // Get uploaded files
            const uploadedFiles = req.files || [];

            if (!wallet_address || !policy_type || !policy_id || !claim_amount || !description || !incident_date) {
                return res.status(400).json({
                    success: false,
                    message: 'All required fields must be provided'
                });
            }

            // Validate policy_type
            if (!['home', 'car', 'travel'].includes(policy_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid policy type. Must be home, car, or travel'
                });
            }

            const connection = getConnection();

            // Generate unique claim ID
            const timestamp = Date.now();
            const claim_id = `CLM-${timestamp.toString().slice(-6)}`;

            // Verify policy exists and belongs to user
            const tables = {
                'home': 'home_insurance_quotes',
                'car': 'car_insurance_quotes',
                'travel': 'travel_insurance_quotes'
            };

            const [policyCheck] = await connection.execute(
                `SELECT id FROM ${tables[policy_type]} WHERE id = ? AND wallet_address = ?`,
                [policy_id, wallet_address]
            );

            if (policyCheck.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Policy not found or does not belong to this wallet'
                });
            }

            // Insert claim
            const [result] = await connection.execute(`
        INSERT INTO insurance_claims 
        (claim_id, wallet_address, policy_type, policy_id, claim_amount, description, 
         incident_date, documents_count, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [claim_id, wallet_address, policy_type, policy_id, claim_amount, description,
                incident_date, uploadedFiles.length]);

            // Store uploaded files as base64 in database
            if (uploadedFiles && uploadedFiles.length > 0) {
                for (const file of uploadedFiles) {
                    // Convert file buffer to base64
                    const base64Data = file.buffer.toString('base64');

                    await connection.execute(`
            INSERT INTO claim_documents 
            (claim_id, document_type, file_name, file_data, file_size, mime_type, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
                        claim_id,
                        'supporting_document',
                        file.originalname,
                        base64Data, // Store as base64
                        file.size,
                        file.mimetype,
                        wallet_address
                    ]);
                }
            }

            // Create notification for user
            await connection.execute(`
        INSERT INTO notifications (wallet_address, type, title, message)
        VALUES (?, ?, ?, ?)
      `, [
                wallet_address,
                'claim_submitted',
                'Claim Submitted Successfully',
                `Your claim ${claim_id} has been submitted and is being reviewed.`
            ]);

            // Create notification for admin
            await connection.execute(`
        INSERT INTO notifications (wallet_address, type, title, message)
        VALUES (?, ?, ?, ?)
      `, [
                'admin',
                'new_claim',
                'New Claim Submitted',
                `New ${policy_type} insurance claim ${claim_id} submitted by ${wallet_address.slice(0, 8)}...`
            ]);

            res.status(201).json({
                success: true,
                message: 'Claim submitted successfully',
                data: {
                    claim_id,
                    status: 'pending',
                    submitted_at: new Date().toISOString(),
                    documents_uploaded: uploadedFiles.length,
                    files_info: uploadedFiles.map(file => ({
                        name: file.originalname,
                        size: file.size,
                        type: file.mimetype
                    }))
                }
            });
        } catch (error) {
            console.error('Submit claim with files error:', error);

            // Handle multer errors
            if (error instanceof multer.MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: 'File too large. Maximum size is 10MB per file.'
                    });
                }
                if (error.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({
                        success: false,
                        message: 'Too many files. Maximum 10 files allowed.'
                    });
                }
            }

            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
];

// Get User Claims (keep existing)
// Get User Claims - SIMPLIFIED VERSION
// Get User Claims - SIMPLIFIED & FIXED VERSION
const getUserClaims = async (req, res) => {
  try {
    const { wallet_address } = req.params;
    const { page = 1, limit = 10, status = 'all' } = req.query;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const connection = getConnection();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let claims, countResult;

    if (status === 'all') {
      // Get all claims for user
      [claims] = await connection.execute(`
        SELECT 
          claim_id,
          policy_type,
          claim_amount,
          description,
          incident_date,
          status,
          created_at,
          payout_amount,
          payout_date,
          admin_notes
        FROM insurance_claims
        WHERE wallet_address = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [wallet_address, parseInt(limit), offset]);

      // Get total count
      [countResult] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM insurance_claims
        WHERE wallet_address = ?
      `, [wallet_address]);

    } else {
      // Get filtered claims by status
      [claims] = await connection.execute(`
        SELECT 
          claim_id,
          policy_type,
          claim_amount,
          description,
          incident_date,
          status,
          created_at,
          payout_amount,
          payout_date,
          admin_notes
        FROM insurance_claims
        WHERE wallet_address = ? AND status = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [wallet_address, status, parseInt(limit), offset]);

      // Get total count with filter
      [countResult] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM insurance_claims
        WHERE wallet_address = ? AND status = ?
      `, [wallet_address, status]);
    }

    // Format claims
    const formattedClaims = claims.map(claim => ({
      ...claim,
      formatted_amount: parseFloat(claim.claim_amount).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      }),
      formatted_payout: claim.payout_amount ? parseFloat(claim.payout_amount).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      }) : null,
      days_since_submission: Math.floor((new Date() - new Date(claim.created_at)) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      data: {
        claims: formattedClaims,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(countResult[0].total / parseInt(limit)),
          total_claims: countResult[0].total,
          per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get user claims error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
// Get Claim Status (keep existing)
const getClaimStatus = async (req, res) => {
    try {
        const { claim_id } = req.params;
        const { wallet_address } = req.query;

        if (!claim_id || !wallet_address) {
            return res.status(400).json({
                success: false,
                message: 'Claim ID and wallet address are required'
            });
        }

        const connection = getConnection();

        // Get claim details
        const [claims] = await connection.execute(`
      SELECT 
        claim_id,
        policy_type,
        policy_id,
        claim_amount,
        description,
        incident_date,
        status,
        created_at,
        reviewed_at,
        payout_amount,
        payout_date,
        admin_notes
      FROM insurance_claims
      WHERE claim_id = ? AND wallet_address = ?
    `, [claim_id, wallet_address]);

        if (claims.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Claim not found'
            });
        }

        const claim = claims[0];

        // Get related policy details
        let policyDetails = null;
        const tables = {
            'home': 'home_insurance_quotes',
            'car': 'car_insurance_quotes',
            'travel': 'travel_insurance_quotes'
        };

        if (tables[claim.policy_type]) {
            const [policies] = await connection.execute(`
        SELECT * FROM ${tables[claim.policy_type]} WHERE id = ?
      `, [claim.policy_id]);
            policyDetails = policies[0];
        }

        // Calculate processing timeline
        const timeline = [
            {
                status: 'submitted',
                date: claim.created_at,
                completed: true,
                description: 'Claim submitted successfully'
            },
            {
                status: 'under_review',
                date: claim.created_at,
                completed: ['pending', 'approved', 'rejected', 'processing_payment', 'paid'].includes(claim.status),
                description: 'Claim is being reviewed by our team'
            },
            {
                status: 'decision',
                date: claim.reviewed_at,
                completed: ['approved', 'rejected', 'processing_payment', 'paid'].includes(claim.status),
                description: claim.status === 'rejected' ? 'Claim rejected' : 'Claim approved'
            }
        ];

        if (claim.status === 'approved' || claim.status === 'processing_payment' || claim.status === 'paid') {
            timeline.push({
                status: 'processing_payment',
                date: claim.reviewed_at,
                completed: ['processing_payment', 'paid'].includes(claim.status),
                description: 'Payment is being processed'
            });
        }

        if (claim.status === 'paid') {
            timeline.push({
                status: 'paid',
                date: claim.payout_date,
                completed: true,
                description: 'Payment completed'
            });
        }

        res.json({
            success: true,
            data: {
                ...claim,
                formatted_amount: parseFloat(claim.claim_amount).toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }),
                formatted_payout: claim.payout_amount ? parseFloat(claim.payout_amount).toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }) : null,
                policy_details: policyDetails,
                timeline
            }
        });
    } catch (error) {
        console.error('Get claim status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Upload additional documents
const uploadClaimDocuments = async (req, res) => {
    try {
        const { claim_id } = req.params;
        const { wallet_address, document_type, file_name, file_data, file_size, mime_type } = req.body;

        if (!claim_id || !wallet_address || !document_type || !file_data) {
            return res.status(400).json({
                success: false,
                message: 'Claim ID, wallet address, document type, and file data are required'
            });
        }

        const connection = getConnection();

        // Verify claim belongs to user
        const [claims] = await connection.execute(
            'SELECT id FROM insurance_claims WHERE claim_id = ? AND wallet_address = ?',
            [claim_id, wallet_address]
        );

        if (claims.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Claim not found'
            });
        }

        // Insert document
        const [result] = await connection.execute(`
      INSERT INTO claim_documents (claim_id, document_type, file_name, file_data, file_size, mime_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [claim_id, document_type, file_name, file_data, file_size || 0, mime_type || 'application/octet-stream', wallet_address]);

        // Update documents count
        await connection.execute(`
      UPDATE insurance_claims 
      SET documents_count = (SELECT COUNT(*) FROM claim_documents WHERE claim_id = ?)
      WHERE claim_id = ?
    `, [claim_id, claim_id]);

        // Create notification
        await connection.execute(`
      INSERT INTO notifications (wallet_address, type, title, message)
      VALUES (?, ?, ?, ?)
    `, [
            wallet_address,
            'document_uploaded',
            'Document Uploaded',
            `Document uploaded for claim ${claim_id}: ${document_type}`
        ]);

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            data: {
                document_id: result.insertId,
                claim_id,
                document_type,
                uploaded_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Upload claim documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    submitClaimWithFiles, // NEW: Main function for file uploads
    getUserClaims,
    getClaimStatus,
    uploadClaimDocuments
};