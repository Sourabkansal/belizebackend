const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config({ path: './config.env' });

class ZohoService {
  constructor() {
    this.tokenUrl = process.env.ZOHO_TOKEN_URL;
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.redirectUri = process.env.ZOHO_REDIRECT_URI;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.orgId = process.env.ZOHO_CREATOR_ORG_ID;
    this.appId = process.env.ZOHO_CREATOR_APP_ID;
    this.formName = process.env.ZOHO_CREATOR_FORM_NAME;
    this.conceptFormName = process.env.ZOHO_CREATOR_FORM2_NAME;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Validate required environment variables
    const requiredEnvVars = [
      'ZOHO_TOKEN_URL', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 
      'ZOHO_REDIRECT_URI', 'ZOHO_REFRESH_TOKEN', 'ZOHO_CREATOR_ORG_ID', 
      'ZOHO_CREATOR_APP_ID', 'ZOHO_CREATOR_FORM2_NAME'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.warn('Missing Zoho environment variables:', missingVars);
    }
    
    console.log('Zoho Service initialized with:');
    console.log('- Org ID:', this.orgId);
    console.log('- App ID:', this.appId);
    console.log('- Concept Form Name:', this.conceptFormName);
  }

  async fetchAccessToken() {
    try {
      const url = `${this.tokenUrl}?grant_type=refresh_token&client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${this.redirectUri}&refresh_token=${this.refreshToken}`;
      const response = await axios.post(url);
      
      if (response.data && response.data.access_token) {
        console.log("Access token generated: ", response.data.access_token);
        this.accessToken = response.data.access_token;
        // Set token expiry (Zoho tokens typically expire in 1 hour)
        this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        return response.data.access_token;
      } else {
        throw new Error("Access token not found in the response.");
      }
    } catch (error) {
      console.error("Error fetching access token:", error.message);
      throw error;
    }
  }

  async getValidAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    // Fetch new token if expired or not available
    return await this.fetchAccessToken();
  }

  async createProposalRecord(proposalData) {
    try {
      const accessToken = await this.getValidAccessToken();
      
      // Map frontend data to Zoho Creator field names
      const zohoData = this.mapToZohoFields(proposalData);
      
      const url = `https://creator.zoho.com/api/v2/${this.orgId}/${this.appId}/form/${this.formName}`;
      
      const headers = {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      };

      const payload = {
        data: zohoData
      };

      console.log('Creating Zoho Creator record with data:', JSON.stringify(payload, null, 2));
      console.log('Zoho Creator URL:', url);
      console.log('Zoho Creator Headers:', headers);
      console.log('Raw request payload:', payload);

      const response = await axios.post(url, payload, { headers });
      
      console.log('Zoho Creator Response Status:', response.status);
      console.log('Zoho Creator Response Data:', JSON.stringify(response.data, null, 2));
      
      // Check for validation errors (code 3002 indicates validation errors)
      if (response.data && response.data.code === 3002 && response.data.error) {
        console.error('Zoho Creator validation errors:', response.data.error);
        const errorMessages = Object.values(response.data.error).join(', ');
        throw new Error(`Zoho Creator validation failed: ${errorMessages}`);
      }
      
      // Check for invalid column values (code 3001 indicates invalid field values)
      if (response.data && response.data.code === 3001 && response.data.error) {
        console.error('Zoho Creator invalid column values:', response.data.error);
        const errorMessages = Array.isArray(response.data.error) ? response.data.error.join(', ') : response.data.error;
        throw new Error(`Zoho Creator invalid field values: ${errorMessages}`);
      }
      
      // Check for successful response
      if (response.data && response.data.data) {
        console.log('Record created successfully in Zoho Creator:', response.data.data);
        return {
          success: true,
          recordId: response.data.data.ID,
          message: 'Record created successfully in Zoho Creator'
        };
      } else {
        console.error('Zoho Creator response structure:', response.data);
        throw new Error('Invalid response from Zoho Creator');
      }
    } catch (error) {
      console.error('Error creating record in Zoho Creator:', error.message);
      if (error.response) {
        console.error('Zoho Creator Error Response Status:', error.response.status);
        console.error('Zoho Creator Error Response Data:', JSON.stringify(error.response.data, null, 2));
        console.error('Zoho Creator Error Response Headers:', error.response.headers);
      }
      throw error;
    }
  }

  async createCommunityProposalRecord(proposalData) {
    try {
      const accessToken = await this.getValidAccessToken();
      const zohoData = this.mapToZohoFields(proposalData);
      const communityFormName = process.env.ZOHO_CREATOR_COMMUNITY_FORM_NAME;
      const url = `https://creator.zoho.com/api/v2/${this.orgId}/${this.appId}/form/${communityFormName}`;
      const headers = {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      };
      const payload = { data: zohoData };
      const response = await axios.post(url, payload, { headers });
      if (response.data && response.data.data) {
        return {
          success: true,
          recordId: response.data.data.ID,
          message: 'Community proposal record created successfully in Zoho Creator'
        };
      } else {
        throw new Error('Invalid response from Zoho Creator for community proposal');
      }
    } catch (error) {
      throw error;
    }
  }

  mapToZohoFields(proposalData) {
    const mappedData = {};

    // Helper function to format dates for Zoho Creator (DD-MMM-YYYY format)
    const formatDateForZoho = (dateString) => {
      if (!dateString) return null;
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = date.getDate().toString().padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}-${month}-${year}`;
      } catch (error) {
        console.warn('Error formatting date:', dateString, error);
        return null;
      }
    };

    // Helper function to safely add field if it's valid and not a File object
    const addFieldIfValidAndNotFile = (value, fieldName) => {
      if (value === null || value === undefined || value === '' || value instanceof File) {
        return;
      }
      mappedData[fieldName] = value;
    };

    // --- Scalar Mappings ---
    addFieldIfValidAndNotFile(proposalData.projectTitle, 'Project_Title');
    addFieldIfValidAndNotFile(proposalData.projectTitle, 'Project_title1'); // Redundant field, but mapped as per sample

    // Dates
    const proposedStartDateFormatted = formatDateForZoho(proposalData.proposedStartDate);
    if (proposedStartDateFormatted) mappedData.Proposed_Start_Date = proposedStartDateFormatted;
    const registrationDateFormatted = formatDateForZoho(proposalData.registrationDate);
    if (registrationDateFormatted) mappedData.Registration_Date = registrationDateFormatted;
    const dateOfIncorporationFormatted = formatDateForZoho(proposalData.dateOfIncorporation);
    if (dateOfIncorporationFormatted) mappedData.Date_of_incorporation_of_Organization = dateOfIncorporationFormatted;
    const expectedEndDateFormatted = formatDateForZoho(proposalData.expectedEndDate);
    if (expectedEndDateFormatted) mappedData.Expected_End_Date = expectedEndDateFormatted;
    const declarationDateFormatted = formatDateForZoho(proposalData.declarationDate);
    if (declarationDateFormatted) mappedData.Declaration_Date = declarationDateFormatted;

    // Organization Details
    addFieldIfValidAndNotFile(proposalData.organizationName, 'Organization');
    addFieldIfValidAndNotFile(proposalData.organizationName, 'Recipient_Organization');
    addFieldIfValidAndNotFile(proposalData.organizationAddress, 'Organization_Address');
    // addFieldIfValidAndNotFile(proposalData.legalStatus, 'Legal_Status');
    // addFieldIfValidAndNotFile(proposalData.organizationType, 'Type_of_Organization');
    addFieldIfValidAndNotFile(proposalData.organizationVision, 'Organization_Vision');
    addFieldIfValidAndNotFile(proposalData.organizationMission, 'Organization_Mission');
    addFieldIfValidAndNotFile(proposalData.organizationalBackground, 'Organizational_Background_and_Capacity');
    addFieldIfValidAndNotFile(proposalData.previousRelevantProjects, 'Relevant_Previous_Projects');
    addFieldIfValidAndNotFile(proposalData.partnerOrganizations, 'Partner_Organizations_if_applicable');

    // Contact Information
    addFieldIfValidAndNotFile(proposalData.contactName, 'Contact_Name');
    addFieldIfValidAndNotFile(proposalData.contactPosition, 'Position');
    addFieldIfValidAndNotFile(proposalData.contactEmail, 'Email');
    addFieldIfValidAndNotFile(proposalData.contactTelephone, 'Telephone');
    addFieldIfValidAndNotFile(proposalData.projectManagerName, 'Project_Manager_Name');
    addFieldIfValidAndNotFile(proposalData.projectManagerQualifications, 'Project_Manager_Qualifications');
    addFieldIfValidAndNotFile(proposalData.legalRepresentativeName, 'Legal_Representative_Name');
    addFieldIfValidAndNotFile(proposalData.legalRepresentativeTitle, 'Legal_Representative_Title');


    // Project Details
    addFieldIfValidAndNotFile(proposalData.projectSummary, 'Project_Summary');
    addFieldIfValidAndNotFile(proposalData.projectEnvironment, 'Project_Environment');
    addFieldIfValidAndNotFile(proposalData.primaryLocation, 'Project_Location');
    addFieldIfValidAndNotFile(proposalData.latitude, 'Latitude');
    addFieldIfValidAndNotFile(proposalData.longitude, 'Longitude');
    // addFieldIfValidAndNotFile(proposalData.primaryThematicArea, 'Primary_Belize_Fund_Thematic_Area'); // Do not map this field for now
    // addFieldIfValidAndNotFile(proposalData.secondaryThematicArea, 'Secondary_Thematic_Area_if_applicable');
    addFieldIfValidAndNotFile(proposalData.logicalFrameworkGoal, 'Goal'); // Mapping logicalFrameworkGoal to 'Goal' in Zoho
    addFieldIfValidAndNotFile(proposalData.stakeholderEngagementPlan, 'Stakeholder_Engagement_Plan_SEP');
    addFieldIfValidAndNotFile(proposalData.sustainabilityPlan, 'SUSTAINABILITY_REPLICATION1');
    addFieldIfValidAndNotFile(proposalData.replicationPotential, 'SUSTAINABILITY_REPLICATION1'); // Assuming this is an alternative input for the same field, latest will override or combine.

    // Calculate Project_Duration1 (days)
    if (proposalData.proposedStartDate && proposalData.expectedEndDate) {
      const startDate = new Date(proposalData.proposedStartDate);
      const endDate = new Date(proposalData.expectedEndDate);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const durationInDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        mappedData.Project_Duration1 = `${durationInDays} days`;
      }
    }
    addFieldIfValidAndNotFile(proposalData.projectDurationMonths, 'Duration_Months');

    // Project Objective(s) - Concatenate objectives into a single field
    let projectObjectivesText = '';
    if (proposalData.objective1) projectObjectivesText += proposalData.objective1;
    if (proposalData.objective2) projectObjectivesText += (projectObjectivesText ? '\n' : '') + proposalData.objective2;
    if (proposalData.objective3) projectObjectivesText += (projectObjectivesText ? '\n' : '') + proposalData.objective3;
    if (projectObjectivesText) mappedData.Project_Objective_s = projectObjectivesText;
    addFieldIfValidAndNotFile(proposalData.projectGoalObjectives, 'Project_Goal'); // From previous mapping


    // --- Subform Mappings ---

    // ENVIRONMENTAL_AND_SOCIAL_RISK_SCREENING_AND_MITIGATION Subform
    const riskEntries = [];
    if (proposalData.risk1Category || proposalData.risk1Description || proposalData.risk1Impact || proposalData.risk1Mitigation) {
      riskEntries.push({
        Risk_Factors: `Category: ${proposalData.risk1Category || ''}, Description: ${proposalData.risk1Description || ''}, Impact: ${proposalData.risk1Impact || ''}, Mitigation: ${proposalData.risk1Mitigation || ''}`
      });
    }
    if (proposalData.risk2Category || proposalData.risk2Description || proposalData.risk2Impact || proposalData.risk2Mitigation) {
      riskEntries.push({
        Risk_Factors: `Category: ${proposalData.risk2Category || ''}, Description: ${proposalData.risk2Description || ''}, Impact: ${proposalData.risk2Impact || ''}, Mitigation: ${proposalData.risk2Mitigation || ''}`
      });
    }
    if (proposalData.risk3Category || proposalData.risk3Description || proposalData.risk3Impact || proposalData.risk3Mitigation) {
      riskEntries.push({
        Risk_Factors: `Category: ${proposalData.risk3Category || ''}, Description: ${proposalData.risk3Description || ''}, Impact: ${proposalData.risk3Impact || ''}, Mitigation: ${proposalData.risk3Mitigation || ''}`
      });
    }
    if (riskEntries.length > 0) {
      mappedData.ENVIRONMENTAL_AND_SOCIAL_RISK_SCREENING_AND_MITIGATION = riskEntries;
    }

    // Project_Budget_Summary Subform
    const budgetSummaryEntries = [];
    if (proposalData.coFinancingSources) {
      budgetSummaryEntries.push({
        Contributing_Organizations: proposalData.coFinancingSources
      });
    }
    if (budgetSummaryEntries.length > 0) {
      mappedData.Project_Budget_Summary = budgetSummaryEntries;
    }

    // BUDGET scalar field (combining total and individual budget items)
    let budgetSummaryText = `Total Budget Requested: BZ$${proposalData.totalBudgetRequested || 0}. `;
    budgetSummaryText += `Total Co-financing: BZ$${proposalData.totalCoFinancing || 0}. `;
    budgetSummaryText += `Total Project Cost: BZ$${proposalData.totalProjectCost || 0}.\n`;

    const budgetCategories = [
        { key: 'fieldStaffSalary', label: 'Field Staff Salary' },
        { key: 'projectManagerSalary', label: 'Project Manager Salary' },
        { key: 'otherPersonnelCosts', label: 'Other Personnel Costs' },
        { key: 'travelCosts', label: 'Travel Costs' },
        { key: 'equipmentPurchase', label: 'Equipment Purchase' },
        { key: 'equipmentRental', label: 'Equipment Rental' },
        { key: 'materialsCosts', label: 'Materials Costs' },
        { key: 'consultantFees', label: 'Consultant Fees' },
        { key: 'trainingCosts', label: 'Training Costs' },
        { key: 'communicationCosts', label: 'Communication Costs' },
        { key: 'utilitiesCosts', label: 'Utilities Costs' },
        { key: 'maintenanceCosts', label: 'Maintenance Costs' },
        { key: 'vehiclesCosts', label: 'Vehicles Costs' },
        { key: 'insuranceCosts', label: 'Insurance Costs' },
        { key: 'auditCosts', label: 'Audit Costs' },
        { key: 'administrativeCosts', label: 'Administrative Costs' },
        { key: 'evaluationBudget', label: 'Evaluation Budget' }
    ];

    budgetCategories.forEach(({ key, label }) => {
        if (proposalData[key]) {
            budgetSummaryText += `${label}: BZ$${proposalData[key]}. `;
        }
    });
    addFieldIfValidAndNotFile(budgetSummaryText.trim(), 'BUDGET');


    // Project_Monitoring_Evaluation_Plan Subform
    const mePlanEntries = [];
    if (proposalData.meProjectGoal) mePlanEntries.push({ Outcome_Outputs: `Project Goal: ${proposalData.meProjectGoal}` });
    if (proposalData.meProjectObjectives) mePlanEntries.push({ Outcome_Outputs: `Project Objectives: ${proposalData.meProjectObjectives}` });
    if (proposalData.monitoringEvaluationPlan) mePlanEntries.push({ Outcome_Outputs: `M&E Plan: ${proposalData.monitoringEvaluationPlan}` });
    if (proposalData.monitoringIntegration) mePlanEntries.push({ Outcome_Outputs: `Monitoring Integration: ${proposalData.monitoringIntegration}` });
    if (proposalData.midTermEvaluationPlan) mePlanEntries.push({ Outcome_Outputs: `Mid-Term Evaluation: ${proposalData.midTermEvaluationPlan}` });
    if (proposalData.endProjectEvaluationPlan) mePlanEntries.push({ Outcome_Outputs: `End Project Evaluation: ${proposalData.endProjectEvaluationPlan}` });
    if (proposalData.lessonLearning) mePlanEntries.push({ Outcome_Outputs: `Lesson Learning: ${proposalData.lessonLearning}` });

    // Individual Indicators
    const indicators = [
      { id: '1', description: 'indicator1Description', baseline: 'indicator1Baseline', frequency: 'indicator1Frequency', outcome: 'indicator1Outcome', responsible: 'indicator1Responsible', target: 'indicator1Target', verification: 'indicator1Verification' },
      { id: '2', description: 'indicator2Description', baseline: 'indicator2Baseline', frequency: 'indicator2Frequency', outcome: 'indicator2Outcome', responsible: 'indicator2Responsible', target: 'indicator2Target', verification: 'indicator2Verification' },
      { id: '3', description: 'indicator3Description', baseline: 'indicator3Baseline', frequency: 'indicator3Frequency', outcome: 'indicator3Outcome', responsible: 'indicator3Responsible', target: 'indicator3Target', verification: 'indicator3Verification' },
    ];

    indicators.forEach(ind => {
      const hasIndicatorData = Object.keys(ind).some(key => key !== 'id' && proposalData[ind[key]]);
      if (hasIndicatorData) {
        mePlanEntries.push({
          Outcome_Outputs: `Indicator ${ind.id}: ${proposalData[ind.description] || ''}. Baseline: ${proposalData[ind.baseline] || ''}. Frequency: ${proposalData[ind.frequency] || ''}. Outcome: ${proposalData[ind.outcome] || ''}. Responsible: ${proposalData[ind.responsible] || ''}. Target: ${proposalData[ind.target] || ''}. Verification: ${proposalData[ind.verification] || ''}.`
        });
      }
    });

    if (mePlanEntries.length > 0) {
      mappedData.Project_Monitoring_Evaluation_Plan = mePlanEntries;
    }

    // Logical Framework fields (as scalar text fields, assuming direct mapping for now)
    addFieldIfValidAndNotFile(proposalData.outcome1, 'Outcome1');
    addFieldIfValidAndNotFile(proposalData.outcome2, 'Outcome2');
    addFieldIfValidAndNotFile(proposalData.outcome3, 'Outcome3');
    addFieldIfValidAndNotFile(proposalData.output1_1, 'Output1_1');
    addFieldIfValidAndNotFile(proposalData.output1_2, 'Output1_2');
    addFieldIfValidAndNotFile(proposalData.output2_1, 'Output2_1');
    addFieldIfValidAndNotFile(proposalData.output2_2, 'Output2_2');
    addFieldIfValidAndNotFile(proposalData.output3_1, 'Output3_1');
    addFieldIfValidAndNotFile(proposalData.output3_2, 'Output3_2');
    addFieldIfValidAndNotFile(proposalData.assumptions1, 'Assumptions1');
    addFieldIfValidAndNotFile(proposalData.assumptions2, 'Assumptions2');
    addFieldIfValidAndNotFile(proposalData.assumptions3, 'Assumptions3');
    addFieldIfValidAndNotFile(proposalData.responsibleParty, 'Responsible_Party');
    addFieldIfValidAndNotFile(proposalData.verification1, 'Verification1');
    addFieldIfValidAndNotFile(proposalData.verification2, 'Verification2');
    addFieldIfValidAndNotFile(proposalData.verification3, 'Verification3');

    // Other relevant text fields (from payload)
    addFieldIfValidAndNotFile(proposalData.additionalRisks, 'Additional_Risks');
    addFieldIfValidAndNotFile(proposalData.alignmentJustification, 'Alignment_Justification');
    addFieldIfValidAndNotFile(proposalData.capacityBuilding, 'Capacity_Building');
    addFieldIfValidAndNotFile(proposalData.disseminationPlans, 'Dissemination_Plans');
    addFieldIfValidAndNotFile(proposalData.environmentalSustainability, 'Environmental_Sustainability');
    addFieldIfValidAndNotFile(proposalData.equipmentJustification, 'Equipment_Justification');
    addFieldIfValidAndNotFile(proposalData.implementationDuration, 'Implementation_Duration');
    addFieldIfValidAndNotFile(proposalData.implementationTimeline, 'Implementation_Timeline');
    addFieldIfValidAndNotFile(proposalData.knowledgeTransfer, 'Knowledge_Transfer');
    addFieldIfValidAndNotFile(proposalData.communityStewardship, 'Community_Stewardship');
    addFieldIfValidAndNotFile(proposalData.ecosystemServices, 'Ecosystem_Services');
    addFieldIfValidAndNotFile(proposalData.revenueGeneration, 'Revenue_Generation');
    addFieldIfValidAndNotFile(proposalData.postProjectFunding, 'Post_Project_Funding');
    addFieldIfValidAndNotFile(proposalData.scalingStrategy, 'Scaling_Strategy');
    addFieldIfValidAndNotFile(proposalData.personnelJustification, 'Personnel_Justification');
    addFieldIfValidAndNotFile(proposalData.operationalJustification, 'Operational_Justification');
    addFieldIfValidAndNotFile(proposalData.environmentalSocialRiskSummary, 'Environmental_Social_Risk_Summary');

    // Status/Notes for files (not the files themselves)
    addFieldIfValidAndNotFile(proposalData.generalDoc0Status, 'General_Document_0_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc0Notes, 'General_Document_0_Notes');
    addFieldIfValidAndNotFile(proposalData.generalDoc1Status, 'General_Document_1_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc1Notes, 'General_Document_1_Notes');
    addFieldIfValidAndNotFile(proposalData.generalDoc2Status, 'General_Document_2_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc2Notes, 'General_Document_2_Notes');
    addFieldIfValidAndNotFile(proposalData.generalDoc3Status, 'General_Document_3_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc3Notes, 'General_Document_3_Notes');
    addFieldIfValidAndNotFile(proposalData.generalDoc4Status, 'General_Document_4_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc4Notes, 'General_Document_4_Notes');
    addFieldIfValidAndNotFile(proposalData.generalDoc5Status, 'General_Document_5_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc5Notes, 'General_Document_5_Notes');
    addFieldIfValidAndNotFile(proposalData.generalDoc6Status, 'General_Document_6_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc6Notes, 'General_Document_6_Notes');
    addFieldIfValidAndNotFile(proposalData.generalDoc7Status, 'General_Document_7_Status');
    addFieldIfValidAndNotFile(proposalData.generalDoc7Notes, 'General_Document_7_Notes');
    addFieldIfValidAndNotFile(proposalData.environmentalClearanceRequired, 'Environmental_Clearance_Required');
    addFieldIfValidAndNotFile(proposalData.environmentalClearanceNotes, 'Environmental_Clearance_Notes');
    addFieldIfValidAndNotFile(proposalData.esrstStatus, 'ESRST_Status');
    addFieldIfValidAndNotFile(proposalData.esrstRiskLevel, 'ESRST_Risk_Level');
    addFieldIfValidAndNotFile(proposalData.esrmpStatus, 'ESRMP_Status');
    addFieldIfValidAndNotFile(proposalData.gapStatus, 'GAP_Status');
    addFieldIfValidAndNotFile(proposalData.excelBudgetStatus, 'Excel_Budget_Status');

    console.log('Final Mapped Zoho data for Proposal:', mappedData);
    return mappedData;
  }

  async createConceptRecord(conceptData) {
    try {
      const accessToken = await this.getValidAccessToken();
      
      // Map frontend data to Zoho Creator field names for concept paper
      const zohoData = this.mapConceptToZohoFields(conceptData);
      
      // Use the concept paper form name from environment
      const conceptFormName = process.env.ZOHO_CREATOR_FORM2_NAME;
      const url = `https://creator.zoho.com/api/v2/${this.orgId}/${this.appId}/form/${conceptFormName}`;
      console.log('Zoho Creator Concept URL:', url);
      const headers = {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      };

      const payload = {
        data: zohoData
      };

      console.log('Creating Zoho Creator concept record with data:', JSON.stringify(payload, null, 2));
      console.log('Zoho Creator Concept URL:', url);
      console.log('Zoho Creator Headers:', headers);
      console.log('Raw concept request payload:', payload);

      const response = await axios.post(url, payload, { headers });
      
      console.log('Zoho Creator Concept Response Status:', response.status);
      console.log('Zoho Creator Concept Response Data:', JSON.stringify(response.data, null, 2));
      
      // Check for validation errors (code 3002 indicates validation errors)
      if (response.data && response.data.code === 3002 && response.data.error) {
        console.error('Zoho Creator concept validation errors:', response.data.error);
        const errorMessages = Object.values(response.data.error).join(', ');
        throw new Error(`Zoho Creator concept validation failed: ${errorMessages}`);
      }
      
      // Check for invalid column values (code 3001 indicates invalid field values)
      if (response.data && response.data.code === 3001 && response.data.error) {
        console.error('Zoho Creator concept invalid column values:', response.data.error);
        const errorMessages = Array.isArray(response.data.error) ? response.data.error.join(', ') : response.data.error;
        throw new Error(`Zoho Creator concept invalid field values: ${errorMessages}`);
      }
      
      // Check for successful response
      if (response.data && response.data.data) {
        console.log('Concept record created successfully in Zoho Creator:', response.data.data);
        return {
          success: true,
          recordId: response.data.data.ID,
          message: 'Concept record created successfully in Zoho Creator'
        };
      } else {
        console.error('Zoho Creator concept response structure:', response.data);
        throw new Error('Invalid response from Zoho Creator for concept paper');
      }
    } catch (error) {
      console.error('Error creating concept record in Zoho Creator:', error.message);
      if (error.response) {
        console.error('Zoho Creator Concept Error Response Status:', error.response.status);
        console.error('Zoho Creator Concept Error Response Data:', JSON.stringify(error.response.data, null, 2));
        console.error('Zoho Creator Concept Error Response Headers:', error.response.headers);
      }
      throw error;
    }
  }

  mapConceptToZohoFields(conceptData) {
    // Map frontend concept form data to Zoho Creator field names
    // Using exact field names from the provided JSON structure
    const mappedData = {};

    // Helper function to format dates for Zoho Creator (DD-MMM-YYYY format)
    const formatDateForZoho = (dateString) => {
      if (!dateString) return null;
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = date.getDate().toString().padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}-${month}-${year}`;
      } catch (error) {
        console.warn('Error formatting date:', dateString, error);
        return null;
      }
    };

    // Helper function to check if value is valid and not empty
    const addFieldIfValid = (value, fieldName) => {
      if (value !== null && value !== undefined && value !== '') {
        mappedData[fieldName] = value;
      }
    };

    // Helper function to create Project Budget Summary subform data
    const createProjectBudgetSummary = (conceptData) => {
      const budgetSummary = [];
      
      // Define budget categories with their corresponding form fields
      const budgetCategories = [
        { key: 'salaryBudget', category: 'Salary' },
        { key: 'travelBudget', category: 'Travel/accommodation' },
        { key: 'equipmentBudget', category: 'Equipment/supplies' },
        { key: 'contractedServicesBudget', category: 'Contracted Services' },
        { key: 'operationalBudget', category: 'Operational Costs' },
        { key: 'educationBudget', category: 'Education/outreach' },
        { key: 'trainingBudget', category: 'Training' },
        { key: 'administrativeBudget', category: 'Administrative' }
      ];

      // Calculate total budget
      const totalBudget = budgetCategories.reduce((total, cat) => {
        return total + (parseFloat(conceptData[cat.key]) || 0);
      }, 0);

      // Create subform entries for non-zero budget items
      budgetCategories.forEach(({ key, category }) => {
        const amount = parseFloat(conceptData[key]) || 0;
        if (amount > 0) {
          const percentage = totalBudget > 0 ? ((amount / totalBudget) * 100).toFixed(2) : "0.00";
          budgetSummary.push({
            Categories: category,
            Total_Contribution_BZD: amount.toFixed(2),
            Percentage: percentage
          });
        }
      });

      console.log('Generated Project Budget Summary:', budgetSummary);
      return budgetSummary;
    };

    // Background Information Mapping - using exact Zoho field names
    addFieldIfValid(conceptData.projectTitle, 'Project_Title');
    addFieldIfValid(conceptData.organizationName, 'Organization_Name');
    addFieldIfValid(conceptData.organizationAddress, 'Organization_Address');
    addFieldIfValid(conceptData.organizationType, 'Type_of_Organization');
    
    if (conceptData.dateOfIncorporation) {
      const formattedIncorporationDate = formatDateForZoho(conceptData.dateOfIncorporation);
      if (formattedIncorporationDate) mappedData.Date_of_Incorporation_of_Organization = formattedIncorporationDate;
    }

    // Main Contact Information - using exact Zoho field names
    addFieldIfValid(conceptData.contactName, 'Contact_Name');
    addFieldIfValid(conceptData.contactPosition, 'Position');
    addFieldIfValid(conceptData.contactEmail, 'Email');
    addFieldIfValid(conceptData.contactTelephone, 'Telephone');

    // Project Duration - using exact Zoho field names
    if (conceptData.proposedStartDate) {
      const formattedStartDate = formatDateForZoho(conceptData.proposedStartDate);
      if (formattedStartDate) mappedData.Proposed_Start_Date = formattedStartDate;
    }
    addFieldIfValid(conceptData.durationMonths, 'Duration_Months');

    // Award Category and Thematic Area - now single line text fields
    addFieldIfValid(conceptData.awardCategory, 'Award_Category1');
    addFieldIfValid(conceptData.thematicArea, 'Project_Theme');

    // Content Sections - using exact Zoho field names
    addFieldIfValid(conceptData.projectSummary, 'Project_Summary');
    addFieldIfValid(conceptData.projectGoalObjectives, 'Project_Goal_and_Objectives');
    addFieldIfValid(conceptData.projectOutputsActivities, 'Project_Outputs_and_Activities');

    // Budget Information - Calculate totals
    const totalBudgetRequested = 
      (parseFloat(conceptData.salaryBudget) || 0) +
      (parseFloat(conceptData.travelBudget) || 0) +
      (parseFloat(conceptData.equipmentBudget) || 0) +
      (parseFloat(conceptData.contractedServicesBudget) || 0) +
      (parseFloat(conceptData.operationalBudget) || 0) +
      (parseFloat(conceptData.educationBudget) || 0) +
      (parseFloat(conceptData.trainingBudget) || 0) +
      (parseFloat(conceptData.administrativeBudget) || 0);

    // Co-financing information
    const totalCoFinancing = parseFloat(conceptData.totalCoFinancing) || 0;
    
    // Calculate total project cost
    const totalProjectCost = totalBudgetRequested + totalCoFinancing;

    // Add budget fields with exact Zoho field names
    if (totalCoFinancing > 0) {
      mappedData.Total_Co_Financing = totalCoFinancing.toFixed(2);
    }

    if (totalProjectCost > 0) {
      mappedData.Total_Project_Estimated_Cost = totalProjectCost.toFixed(2);
      mappedData.Total_Project_Estimated_Cost_Percentage = "100.00";
    }

    // Add Total2 field (appears to be the requested amount from fund)
    if (totalBudgetRequested > 0) {
      mappedData.Total2 = totalBudgetRequested.toFixed(2);
    }

    // Calculate and add percentage fields
    if (totalProjectCost > 0) {
      const coFinancingPercentage = ((totalCoFinancing / totalProjectCost) * 100).toFixed(2);
      mappedData.Total_Co_Financing_Percentage = coFinancingPercentage;
    }

    // Project Budget Summary Subform - create subform entries for budget breakdown
    const projectBudgetSummary = createProjectBudgetSummary(conceptData);
    if (projectBudgetSummary.length > 0) {
      mappedData.Project_Budget_Summary = projectBudgetSummary;
    }

    // Co-financing entries as text summary (if needed)
    if (totalCoFinancing > 0) {
      mappedData.Co_Financing_Details = `Total Co-financing: $${totalCoFinancing.toFixed(2)}`;
    }

    // Declaration fields (if needed)
    addFieldIfValid(conceptData.legalRepresentativeName, 'Legal_Representative_Name');
    
    if (conceptData.declarationDate) {
      const formattedDeclarationDate = formatDateForZoho(conceptData.declarationDate);
      if (formattedDeclarationDate) mappedData.Declaration_Date = formattedDeclarationDate;
    }

    console.log('Mapped concept data for Zoho (updated with exact field names):', mappedData);
    console.log('Critical field values:', {
      Project_Theme: mappedData.Project_Theme,
      Award_Category1: mappedData.Award_Category1,
      Type_of_Organization: mappedData.Type_of_Organization,
      Project_Budget_Summary_Count: mappedData.Project_Budget_Summary?.length || 0
    });
    
    return mappedData;
  }

  async uploadFileToRecord(recordId, fieldName, fileBuffer, fileName) {
    try {
      const accessToken = await this.getValidAccessToken();
      
      // Use the exact Zoho Creator API format from documentation
      // URL: https://www.zohoapis.com/creator/v2.1/data/<account_owner_name>/<app_link_name>/report/<report_link_name>/<record_ID>/<field_link_name>/upload
      const reportName = 'All_Gap_Concept_Paper';
      const uploadUrl = `https://www.zohoapis.com/creator/v2.1/data/${this.orgId}/${this.appId}/report/${reportName}/${recordId}/${fieldName}/upload`;
      
      console.log('Upload URL:', uploadUrl);
      console.log('Uploading file:', fileName, 'to field:', fieldName, 'for record:', recordId);
      console.log('Org ID:', this.orgId);
      console.log('App ID:', this.appId);
      console.log('Form Name:', this.conceptFormName);
      console.log('Report Name:', reportName);
      
      // Create form data exactly as shown in documentation
      const formData = new FormData();
      formData.append('file', fileBuffer, fileName);
      
      // Headers as per documentation
      const headers = {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        ...formData.getHeaders()
      };

      // Parameters as per documentation - passed as query parameters
      const queryParams = new URLSearchParams({
        skip_workflow: '["schedules","form_workflow"]'
      });

      const fullUrl = `${uploadUrl}?${queryParams.toString()}`;

      console.log('Full upload URL with params:', fullUrl);
      console.log('File upload config:', {
        url: fullUrl,
        headers: Object.keys(headers),
        fileName: fileName,
        fieldName: fieldName,
        reportName: reportName
      });

      // Make the request using axios with the exact format from documentation
      const response = await axios({
        method: 'POST',
        url: fullUrl,
        headers: headers,
        data: formData,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log('File upload response status:', response.status);
      console.log('File upload response data:', response.data);
      
      // Check for successful upload (code 3000 as per documentation)
      if (response.data && response.data.code === 3000) {
        return {
          success: true,
          message: `File ${fileName} uploaded successfully to ${fieldName}`,
          data: response.data
        };
      } else {
        return {
          success: false,
          message: `Upload failed: ${response.data?.message || 'Unknown error'}`,
          error: response.data
        };
      }
      
    } catch (error) {
      console.error(`Error uploading file to ${fieldName}:`, error.message);
      if (error.response) {
        console.error('Upload Error Response Status:', error.response.status);
        console.error('Upload Error Response Data:', error.response.data);
        console.error('Upload Error Response Headers:', error.response.headers);
      }
      
      return {
        success: false,
        message: `Failed to upload file to ${fieldName}: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = new ZohoService(); 