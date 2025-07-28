const express = require('express');
const router = express.Router();
const zohoService = require('../services/zohoService');
const axios = require('axios');

// Test route to verify the router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Zoho Report Router is working!' });
});

router.get('/gap-concept-papers', async (req, res) => {
  try {
    console.log('🔄 Zoho Report API called - fetching data...');
    
    // Check if environment variables are available
    const orgId = process.env.ZOHO_CREATOR_ORG_ID;
    const appId = process.env.ZOHO_CREATOR_APP_ID;
    
    if (!orgId || !appId) {
      console.error('❌ Missing environment variables:', { orgId, appId });
      return res.status(500).json({ 
        success: false, 
        message: 'Missing environment variables',
        error: { orgId: !!orgId, appId: !!appId }
      });
    }
    
    // Use the same logic as in test.js
    const accessToken = await zohoService.getValidAccessToken();
    console.log('✅ Access token obtained');
    
    const apiHeaders = {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    const reportName = 'All_Gap_Concept_Paper';
    const reportUrl = `https://www.zohoapis.com/creator/v2.1/data/${orgId}/${appId}/report/${reportName}`;
    
    console.log('🌐 Making request to:', reportUrl);
    console.log('📋 Headers:', apiHeaders);
    
          const response = await axios.get(reportUrl, {
        headers: apiHeaders,
        params: {
          max_records: 200,
          field_config: 'custom',
          fields: 'Project_Title,Organization,Organization_Name,Contact_Name,Email,Project_Summary,Goal,Thematic_Area,Primary_Belize_Fund_Thematic_Area,Secondary_Thematic_Area_if_applicable,Proposed_Start_Date,Expected_End_Date,Duration_Months,Total2,Total_Co_Financing,Total_Project_Estimated_Cost,Organization_Address,Type_of_Organization,Detailed_Location_Description,Latitude,Longitude,Date_of_incorporation_of_Organization,Position,Telephone,Project_Theme,Award_Category1'
        }
      });
    
    console.log('✅ Zoho API response received:', response.status);
    console.log('📊 Data length:', response.data?.data?.length || 0);
    
    res.json({ success: true, data: response.data.data });
  } catch (error) {
    console.error('❌ Error in Zoho Report API:', error.message);
    if (error.response) {
      console.error('📊 Error Response Status:', error.response.status);
      console.error('📊 Error Response Data:', error.response.data);
    }
    res.status(500).json({ 
      success: false, 
      message: error.message, 
      error: error.response?.data,
      stack: error.stack 
    });
  }
});

module.exports = router; 