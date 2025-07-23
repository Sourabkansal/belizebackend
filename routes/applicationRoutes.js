const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Application = require('../models/Application');
const zohoService = require('../services/zohoService');
const emailService = require('../services/emailService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Validation middleware for original application form (if still in use)
const validateApplication = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('mobile').notEmpty().withMessage('Mobile number is required'),
  body('organizationName').notEmpty().withMessage('Organization name is required'),
];

// Validation middleware for Concept Paper form
const validateConceptPaper = [
  body('projectTitle').notEmpty().withMessage('Project Title is required'),
  body('contactName').notEmpty().withMessage('Contact Name is required'),
  body('contactEmail').isEmail().withMessage('Valid Contact Email is required'),
  body('organizationName').notEmpty().withMessage('Organization Name is required'),
  body('organizationAddress').notEmpty().withMessage('Organization Address is required'),
  body('district').notEmpty().withMessage('District is required'),
  body('organizationType').notEmpty().withMessage('Organization Type is required'),
  body('dateOfIncorporation').notEmpty().withMessage('Date of Incorporation is required'),
  body('contactPosition').notEmpty().withMessage('Contact Position is required'),
  body('contactTelephone').notEmpty().withMessage('Contact Telephone is required'),
  body('proposedStartDate').notEmpty().withMessage('Proposed Start Date is required'),
  body('durationMonths').notEmpty().isNumeric().withMessage('Duration (Months) is required and must be a number'),
  body('thematicArea').notEmpty().withMessage('Thematic Area is required'),
  body('awardCategory').notEmpty().withMessage('Award Category is required'),
  body('projectSummary').notEmpty().withMessage('Project Summary is required'),
  body('projectGoalObjectives').notEmpty().withMessage('Project Goal and Objectives are required'),
  body('projectOutputsActivities').notEmpty().withMessage('Project Outputs and Activities are required'),
  body('totalBudgetRequested').notEmpty().isNumeric().withMessage('Total Budget Requested is required and must be a number'),
  body('legalRepresentativeName').notEmpty().withMessage('Legal Representative Name is required'),
  body('declarationDate').notEmpty().withMessage('Declaration Date is required'),
  // Add more specific validations as needed, e.g., for word counts, min/max values for numbers
];

// Validation middleware for GAP Proposal form
const validateProposal = [
  body('projectTitle').notEmpty().withMessage('Project Title is required'),
  body('contactName').notEmpty().withMessage('Contact Name is required'),
  body('contactEmail').isEmail().withMessage('Valid Contact Email is required'),
  body('organizationName').notEmpty().withMessage('Organization Name is required'),
  body('organizationAddress').notEmpty().withMessage('Organization Address is required'),
  body('dateOfIncorporation').notEmpty().withMessage('Date of Incorporation is required'),
  body('organizationType').notEmpty().withMessage('Organization Type is required'),
  body('proposedStartDate').notEmpty().withMessage('Proposed Start Date is required'),
  body('expectedEndDate').notEmpty().withMessage('Expected End Date is required'),
  body('projectDurationMonths').notEmpty().isNumeric().withMessage('Project Duration (Months) is required and must be a number'),
  body('primaryLocation').notEmpty().withMessage('Primary Location is required'),
  body('primaryThematicArea').notEmpty().withMessage('Primary Thematic Area is required'),
  body('projectGoalObjectives').notEmpty().withMessage('Project Goal and Objectives are required'),
  body('projectSummary').notEmpty().withMessage('Project Summary is required'),
  body('projectOutputsActivities').notEmpty().withMessage('Project Outputs and Activities are required'),
  body('amountRequested').notEmpty().isNumeric().withMessage('Amount Requested is required and must be a number'),
  body('totalCoFinancing').notEmpty().isNumeric().withMessage('Total Co-Financing is required and must be a number'),
  body('legalRepresentativeName').notEmpty().withMessage('Legal Representative Name is required'),
  body('declarationDate').notEmpty().withMessage('Declaration Date is required'),
  body('organizationalBackground').notEmpty().withMessage('Organizational Background and Capacity is required'),
  body('projectManagerName').notEmpty().withMessage('Project Manager Name is required'),
  body('projectManagerQualifications').notEmpty().withMessage('Project Manager Qualifications are required'),
];

// Get all applications
router.get('/', async (req, res) => {
  try {
    const applications = await Application.find()
      .sort({ createdAt: -1 })
      .select('applicationId organizationName firstName lastName applicationStatus createdAt updatedAt');
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ 
      message: 'Error fetching applications', 
      error: error.message 
    });
  }
});

// Get application by ID
router.get('/:id', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ 
      message: 'Error fetching application', 
      error: error.message 
    });
  }
});

// Create new application (for MongoDB, if still used for initial app creation)
router.post('/', async (req, res) => {
  try {
    const application = new Application(req.body);
    await application.save();
    res.status(201).json(application);
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(400).json({ 
      message: 'Error creating application', 
      error: error.message 
    });
  }
});

// Update application (for saving progress)
router.put('/:id', async (req, res) => {
  try {
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    
    res.json(application);
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(400).json({ 
      message: 'Error updating application', 
      error: error.message 
    });
  }
});

// Save progress (partial update)
router.put('/:id/progress', async (req, res) => {
  try {
    const { currentStep, stepData, completedSteps } = req.body;
    
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      {
        ...stepData,
        currentStep,
        completedSteps,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    
    res.json(application);
  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(400).json({ 
      message: 'Error saving progress', 
      error: error.message 
    });
  }
});

// Submit application (final submission) - original application form
router.put('/:id/submit', async (req, res) => {
  try {
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        applicationStatus: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Create record in Zoho Creator
    let zohoResult = null;
    try {
      // This route is for the main application, not concept paper, so it should use createProposalRecord
      zohoResult = await zohoService.createProposalRecord(req.body);
      console.log('Zoho Creator record created successfully:', zohoResult);
    } catch (zohoError) {
      console.error('Error creating Zoho Creator record:', zohoError);
      // Continue with application submission even if Zoho fails
    }
    
    res.json({
      ...application.toObject(),
      zohoRecordId: zohoResult?.recordId,
      zohoSuccess: !!zohoResult?.success,
      zohoError: zohoResult ? null : 'Failed to create Zoho Creator record'
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(400).json({ 
      message: 'Error submitting application', 
      error: error.message 
    });
  }
});

// Submit Concept Paper to Zoho Creator
router.post('/zoho/concept', upload.none(), validateConceptPaper, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('Received Concept Paper data for Zoho:', req.body);

    // Check eligibility before sending to Zoho (example logic, adjust as needed)
    const eligibilityCheck = checkEligibility(req.body);
    if (!eligibilityCheck.isEligible) {
      // Send ineligibility email
      await emailService.sendIneligibilityEmail(req.body.contactEmail, eligibilityCheck.reason);
      return res.status(403).json({
        success: false,
        message: eligibilityCheck.reason,
        eligibility: false,
      });
    }

    // Create record in Zoho Creator
    const zohoResult = await zohoService.createConceptRecord(req.body);
    
    if (zohoResult.success) {
      // Send success email
      await emailService.sendSuccessEmail(req.body.contactEmail, req.body.projectTitle);
      res.status(200).json({ 
        success: true, 
        message: 'Concept paper submitted and Zoho record created successfully!', 
        recordId: zohoResult.recordId, 
        eligibility: true 
      });
    } else {
      console.error('Zoho Creator submission failed:', zohoResult.error);
      res.status(500).json({ 
        success: false, 
        message: zohoResult.message || 'Failed to submit concept paper to Zoho Creator', 
        error: zohoResult.error, 
        eligibility: true 
      });
    }
  } catch (error) {
    console.error('Error creating Zoho Creator record:', error);
    res.status(500).json({ 
      message: 'Error creating Zoho Creator record', 
      error: error.message 
    });
  }
});

// Submit GAP Proposal to Zoho Creator
router.post('/zoho/proposal', upload.none(), validateProposal, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('Received GAP Proposal data for Zoho:', req.body);

    // Check eligibility before sending to Zoho
    const eligibilityCheck = checkEligibility(req.body);
    if (!eligibilityCheck.isEligible) {
      await emailService.sendIneligibilityEmail(req.body.contactEmail, eligibilityCheck.reason);
      return res.status(403).json({
        success: false,
        message: eligibilityCheck.reason,
        eligibility: false,
      });
    }

    // Create record in Zoho Creator
    const zohoResult = await zohoService.createProposalRecord(req.body);
    
    if (zohoResult.success) {
      await emailService.sendSuccessEmail(req.body.contactEmail, req.body.projectTitle);
      res.status(200).json({ 
        success: true, 
        message: 'GAP Proposal submitted and Zoho record created successfully!', 
        recordId: zohoResult.recordId, 
        eligibility: true 
      });
    } else {
      console.error('Zoho Creator submission failed:', zohoResult.error);
      res.status(500).json({ 
        success: false, 
        message: zohoResult.message || 'Failed to submit GAP Proposal to Zoho Creator', 
        error: zohoResult.error, 
        eligibility: true 
      });
    }
  } catch (error) {
    console.error('Error creating Zoho Creator record for GAP Proposal:', error);
    res.status(500).json({ 
      message: 'Error creating Zoho Creator record for GAP Proposal', 
      error: error.message 
    });
  }
});

// Submit Community Proposal to Zoho Creator
router.post('/zoho/community-proposal', upload.none(), async (req, res) => {
  try {
    const zohoResult = await zohoService.createCommunityProposalRecord(req.body);
    if (zohoResult.success) {
      res.status(200).json({
        success: true,
        message: 'Community Proposal submitted and Zoho record created successfully!',
        recordId: zohoResult.recordId
      });
    } else {
      res.status(500).json({
        success: false,
        message: zohoResult.message || 'Failed to submit Community Proposal to Zoho Creator',
        error: zohoResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error creating Zoho Creator record for Community Proposal',
      error: error.message
    });
  }
});

// Zoho file upload endpoint (will be used after record creation)
router.post('/zoho/upload/:recordId/:fieldName', upload.single('file'), async (req, res) => {
  try {
    const { recordId, fieldName } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    console.log(`Uploading file ${file.originalname} to record ${recordId}, field ${fieldName}`);
    const uploadResult = await zohoService.uploadFileToRecord(recordId, fieldName, file.buffer, file.originalname);

    if (uploadResult.success) {
      res.status(200).json({ success: true, message: uploadResult.message });
    } else {
      res.status(500).json({ success: false, message: uploadResult.message, error: uploadResult.error });
    }
  } catch (error) {
    console.error('Error handling file upload:', error);
    res.status(500).json({ success: false, message: 'Server error during file upload', error: error.message });
  }
});

// Delete application
router.delete('/:id', async (req, res) => {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ 
      message: 'Error deleting application', 
      error: error.message 
    });
  }
});

// Get applications by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const applications = await Application.find({ applicationStatus: status })
      .sort({ createdAt: -1 })
      .select('applicationId organizationName firstName lastName applicationStatus createdAt updatedAt');
    res.json(applications);
  } catch (error) {
    console.error(`Error fetching applications with status ${status}:`, error);
    res.status(500).json({ 
      message: `Error fetching applications with status ${status}`, 
      error: error.message 
    });
  }
});

// Eligibility Check Function (can be moved to a service if it grows)
const checkEligibility = (data) => {
  const now = new Date();
  const incorporationDate = new Date(data.dateOfIncorporation);
  const yearDiff = now.getFullYear() - incorporationDate.getFullYear();
  const monthDiff = now.getMonth() - incorporationDate.getMonth();
  const dayDiff = now.getDate() - incorporationDate.getDate();

  const isOneYearOld = yearDiff > 1 || (yearDiff === 1 && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)));
  const isGovernmentBody = data.organizationType === 'Government Body' || data.organizationType === 'Statutory Body';

  if (isGovernmentBody) {
    return { isEligible: false, reason: 'Organization type (Government Body/Statutory Body) is not eligible.' };
  }
  if (!isOneYearOld) {
    return { isEligible: false, reason: 'Organization must be incorporated for at least one year to be eligible.' };
  }

  return { isEligible: true, reason: 'Eligibility criteria met.' };
};

module.exports = router; 