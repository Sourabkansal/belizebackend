const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  // Core Application Fields
  applicationId: {
    type: String,
    unique: true,
    default: function() {
      return 'APP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
  },
  categoryShortcode: String,
  slug: String,
  
  // Basic Information
  organizationName: String,
  season: String,
  form: String,
  
  // Applicant Information
  firstName: String,
  lastName: String,
  email: String,
  mobile: String,
  userId: String,
  
  // Category Information
  parentCategory: String,
  category: String,
  categoryId: String,
  
  // Status Fields
  applicationStatus: {
    type: String,
    default: 'draft'
  },
  actionStatus: String,
  moderationStatus: String,
  paymentStatus: String,
  eligibilityStatus: String,
  
  // Metadata
  filesCount: { type: Number, default: 0 },
  contributors: [String],
  applicationComments: [String],
  links: [String],
  fundAllocations: String,
  autoScore: { type: Number, default: 0 },
  userComments: [String],
  
  // Organization Details (Step 1)
  typeOfOrganisation: String,
  website: String,
  legalRepName: String,
  organizationAge: Number,
  organizationType: String,
  legalRepPosition: String,
  operationalStatus: String,
  emailAddress: String,
  officePhoneNumber: String,
  physicalAddress: String,
  
  // Location Information
  proposalVillage: String,
  proposalTown: String,
  proposalCity: String,
  district: String,
  proposalProjectLocation: String,
  
  // Project Information
  awardAgreementSigned: Boolean,
  belizeFundApprovalDate: Date,
  projectId: String,
  projectTitle: String,
  projectGoal: String,
  projectObjectives: String,
  
  // Compliance & Documentation
  completedGAPForm: Boolean,
  awardAgreement: String,
  grantAmountRequested: Number,
  bankDetails: String,
  coFinancing: String,
  proposedProjectBudget: String,
  
  // Assessment Results
  esrstResult: String,
  esrst: String,
  esrmp: String,
  gap: String,
  sep: String,
  
  // Contact Details
  position: String,
  mobileTelephone: String,
  officeTelephone: String,
  villageOrTown: String,
  contactDistrict: String,
  
  // Project Description
  projectDescription: String,
  incorporationDate: Date,
  legalDocuments: [String],
  organizationLegalStatus: String,
  purposeAndActivities: String,
  organizationBackground: String,
  
  // Logical Framework
  c1LogicalFramework: String,
  projectGoalLF: String,
  purpose: String,
  
  // Outputs - Specific Objective 1
  specificObjective1: String,
  output1_1: String,
  output1_2: String,
  output1_3: String,
  
  // Outputs - Specific Objective 2
  specificObjective2: String,
  output2_1: String,
  output2_2: String,
  output2_3: String,
  
  // Outputs - Specific Objective 3
  specificObjective3: String,
  output3_1: String,
  output3_2: String,
  output3_3: String,
  
  // Auto-scoring Fields
  organizationAgeScore: { type: Number, default: 0 },
  organizationTypeScore: { type: Number, default: 0 },
  operationalStatusScore: { type: Number, default: 0 },
  
  // Progress Tracking
  currentStep: { type: Number, default: 1 },
  completedSteps: [Number],
  
  // Timestamps
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now },
  submitted: Date
});

// Auto-scoring logic
applicationSchema.methods.calculateAutoScore = function() {
  let score = 0;
  
  // Organization age scoring
  if (this.organizationAge >= 5) score += 30;
  else if (this.organizationAge >= 3) score += 20;
  else if (this.organizationAge >= 1) score += 10;
  
  // Organization type scoring
  const typeScores = {
    'NGO': 25,
    'CBO': 20,
    'Cooperative': 15,
    'Private': 10,
    'Government': 5
  };
  score += typeScores[this.organizationType] || 0;
  
  // Operational status scoring
  const statusScores = {
    'Fully Operational': 25,
    'Partially Operational': 15,
    'Starting Operations': 10,
    'Not Operational': 0
  };
  score += statusScores[this.operationalStatus] || 0;
  
  this.organizationAgeScore = this.organizationAge >= 5 ? 30 : (this.organizationAge >= 3 ? 20 : 10);
  this.organizationTypeScore = typeScores[this.organizationType] || 0;
  this.operationalStatusScore = statusScores[this.operationalStatus] || 0;
  this.autoScore = score;
  
  return score;
};

// Update timestamp on save
applicationSchema.pre('save', function(next) {
  this.updated = Date.now();
  if (this.isModified() && !this.isNew) {
    this.calculateAutoScore();
  }
  next();
});

module.exports = mongoose.model('Application', applicationSchema); 