const axios = require('axios');
require('dotenv').config({ path: './config.env' });

// Import the ZohoService instance to use its authentication
const zohoService = require('./services/zohoService');

async function testZohoReportFetch() {
  try {
    console.log('🚀 Starting Zoho Creator Report Fetch Test...');
    
    // Get valid access token
    console.log('🔑 Getting access token...');
    const accessToken = await zohoService.getValidAccessToken();
    console.log('✅ Access token obtained successfully');
    
    // API headers with the access token
    const apiHeaders = {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    
    console.log('📋 API Headers:', apiHeaders);
    
    // Report URL from the provided link
    // Converting from: https://creatorapp.zoho.com/belizefundforasustainablefut/grant-management-system/#Report:All_Gap_Concept_Paper
    // To API format: https://www.zohoapis.com/creator/v2.1/data/{orgId}/{appId}/report/{reportName}
    
    const orgId = process.env.ZOHO_CREATOR_ORG_ID;
    const appId = process.env.ZOHO_CREATOR_APP_ID;
    const reportName = 'All_Gap_Concept_Paper';
    
    const reportUrl = `https://www.zohoapis.com/creator/v2.1/data/${orgId}/${appId}/report/${reportName}`;
    
    
    // Make the API call to fetch report data
    const response = await axios.get(reportUrl, {
      headers: apiHeaders,
      params: {
        max_records: 200,
        field_config: 'custom',
        fields: 'Project_Title,Organization,Contact_Name,Email,Project_Summary,Goal,Thematic_Area,Primary_Belize_Fund_Thematic_Area,Proposed_Start_Date,Expected_End_Date,Duration_Months,Total2,Total_Co_Financing,Total_Project_Estimated_Cost'
      }
    });
    
    console.log('✅ Report data fetched successfully!');
    console.log('📈 Response Status:', response.status);
    console.log('📊 Response Data Structure:', {
      code: response.data?.code,
      data: response.data?.data ? `${response.data.data.length} records` : 'No data',
      message: response.data?.message
    });
    
    // Log all records for inspection
    if (response.data?.data && response.data.data.length > 0) {
      console.log('\n📋 All Records:');
      console.dir(response.data.data, { depth: null, maxArrayLength: null });
      
      console.log(`\n📊 Total Records: ${response.data.data.length}`);
      
      // Log field names from first record
      if (response.data.data[0]) {
        console.log('\n🏷️ Available Fields:');
        Object.keys(response.data.data[0]).forEach(field => {
          console.log(`  - ${field}`);
        });
      }
    } else {
      console.log('⚠️ No data found in the report');
    }
    
    // Test with specific criteria (optional)
    console.log('\n🔍 Testing with specific criteria...');
    const criteriaResponse = await axios.get(reportUrl, {
      headers: apiHeaders,
      params: {
        max_records: 200,
        criteria: 'Project_Title != ""', // Get records with non-empty project title
        field_config: 'custom',
        fields: 'Project_Title,Organization,Contact_Name,Email,Project_Summary,Goal,Thematic_Area,Primary_Belize_Fund_Thematic_Area,Proposed_Start_Date,Expected_End_Date,Duration_Months,Total2,Total_Co_Financing,Total_Project_Estimated_Cost'
      }
    });
    
    console.log('✅ Criteria-based query successful!');
    console.log(`📊 Records with criteria: ${criteriaResponse.data?.data?.length || 0}`);
    if (criteriaResponse.data?.data && criteriaResponse.data.data.length > 0) {
      console.log('\n📋 All Criteria Records:');
      console.dir(criteriaResponse.data.data, { depth: null, maxArrayLength: null });
    }
    
    return {
      success: true,
      totalRecords: response.data?.data?.length || 0,
      sampleRecord: response.data?.data?.[0] || null,
      criteriaRecords: criteriaResponse.data?.data?.length || 0
    };
    
  } catch (error) {
    console.error('❌ Error in Zoho Report Fetch Test:', error.message);
    
    if (error.response) {
      console.error('📊 Error Response Status:', error.response.status);
      console.error('📊 Error Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
}

// Run the test
async function runTest() {
  try {
    const result = await testZohoReportFetch();
    console.log('\n🎉 Test completed successfully!');
    console.log('📊 Test Results:', result);
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other files
module.exports = { testZohoReportFetch };

// Run test if this file is executed directly
if (require.main === module) {
  runTest();
}
