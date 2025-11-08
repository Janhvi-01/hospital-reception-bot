const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { WebhookClient } = require('dialogflow-fulfillment');

const app = express();
app.use(bodyParser.json());

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RECEPTION_HELPLINE = process.env.RECEPTION_HELPLINE || '+91-XXXXXXXXXX';

// Helper function to read from Google Sheets
async function readSheet(range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Error reading sheet:', error);
    return [];
  }
}

// Logging function (simplified - would append to sheet in production)
function logInteraction(intent, userText, timestamp) {
  // Mask sensitive information for demo
  const maskedText = userText.replace(/\b\d{4,}\b/g, '***');
  console.log(`[${timestamp}] Intent: ${intent}, User: ${maskedText}`);
}

// Webhook handler
app.post('/webhook', async (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  
  // Log the interaction
  const timestamp = new Date().toISOString();
  logInteraction(req.body.queryResult.intent.displayName, 
                req.body.queryResult.queryText, 
                timestamp);

  function welcome(agent) {
    agent.add(`Hello! I'm the hospital receptionist assistant. I can help with: doctor schedules, department info, lab report status, billing queries, registration info, hospital hours, and emergency contacts. How can I help you today?`);
  }

  function fallback(agent) {
    agent.add(`I'm not sure I understand. I can help with: 1) Doctor schedules, 2) Department info, 3) Lab reports, 4) Billing queries. Which would you like? Or call ${RECEPTION_HELPLINE} for immediate assistance.`);
  }

  async function getHospitalHours(agent) {
    try {
      const data = await readSheet('hospital_info!A:B');
      const hours = data.find(row => row[0] === 'hours');
      const holidays = data.find(row => row[0] === 'holidays');
      
      let response = hours ? `Hospital hours: ${hours[1]}. ` : 'Hospital hours not available. ';
      response += holidays ? `Holidays: ${holidays[1]}. ` : '';
      response += `This is demo info — please call reception at ${RECEPTION_HELPLINE} to confirm.`;
      
      agent.add(response);
    } catch (error) {
      agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
    }
  }

  async function getLocation(agent) {
    try {
      const data = await readSheet('hospital_info!A:B');
      const address = data.find(row => row[0] === 'address');
      const parking = data.find(row => row[0] === 'parking');
      const directions = data.find(row => row[0] === 'directions');
      
      let response = address ? `We're located at: ${address[1]}. ` : '';
      response += directions ? `${directions[1]}. ` : '';
      response += parking ? `Parking: ${parking[1]}. ` : '';
      response += `This is demo info — please call reception at ${RECEPTION_HELPLINE} to confirm.`;
      
      agent.add(response);
    } catch (error) {
      agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
    }
  }

  async function getDepartmentInfo(agent) {
    const departmentName = agent.parameters.department_name;
    
    if (!departmentName) {
      agent.add('Which department are you looking for? We have Cardiology, Pediatrics, Orthopedics, and more.');
      return;
    }

    try {
      const data = await readSheet('departments!A:E');
      // Skip header row
      const departments = data.slice(1);
      const department = departments.find(dept => 
        dept[1].toLowerCase().includes(departmentName.toLowerCase())
      );

      if (department) {
        const response = `${department[1]} Department: ${department[2]}. Located on ${department[3]}. Contact: ${department[4]}. This is demo info — please call reception at ${RECEPTION_HELPLINE} to confirm.`;
        agent.add(response);
      } else {
        agent.add(`I couldn't find information for the ${departmentName} department. Please call ${RECEPTION_HELPLINE} for assistance.`);
      }
    } catch (error) {
      agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
    }
  }

  async function getDoctorAvailability(agent) {
    const doctorName = agent.parameters.doctor_name;
    const departmentName = agent.parameters.department_name;

    if (!doctorName && !departmentName) {
      agent.add('Could you specify which doctor or department you\'re looking for?');
      return;
    }

    try {
      const data = await readSheet('doctors!A:G');
      const doctors = data.slice(1); // Skip header
      
      let matchingDoctors = [];
      
      if (doctorName) {
        matchingDoctors = doctors.filter(doctor => 
          doctor[1].toLowerCase().includes(doctorName.toLowerCase())
        );
      } else if (departmentName) {
        matchingDoctors = doctors.filter(doctor => 
          doctor[2].toLowerCase().includes(departmentName.toLowerCase())
        );
      }

      if (matchingDoctors.length === 0) {
        agent.add(`No doctors found. Please call ${RECEPTION_HELPLINE} for assistance.`);
      } else if (matchingDoctors.length === 1) {
        const doctor = matchingDoctors[0];
        const response = `Dr. ${doctor[1]} (${doctor[2]}): Available ${doctor[3]} from ${doctor[4]}. ${doctor[5]}. This is demo info — please call reception at ${RECEPTION_HELPLINE} to confirm.`;
        agent.add(response);
      } else {
        // Multiple matches - ask for clarification
        const doctorList = matchingDoctors.map(d => d[1]).join(', ');
        agent.add(`I found multiple doctors: ${doctorList}. Which one are you looking for?`);
      }
    } catch (error) {
      agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
    }
  }

  async function getLabReportStatus(agent) {
    const sampleId = agent.parameters.sample_id;

    if (!sampleId) {
      agent.add('Please provide your sample ID to check the lab report status.');
      return;
    }

    try {
      const data = await readSheet('lab_reports!A:F');
      const reports = data.slice(1);
      const report = reports.find(rep => rep[0] === sampleId);

      if (report) {
        let response = `Sample ${sampleId}: Status is ${report[4]}. `;
        if (report[4] === 'Ready') {
          response += 'You can collect your report from the lab reception. ';
        } else if (report[4] === 'Delivered') {
          response += 'Report has been delivered to your doctor. ';
        }
        response += report[5] ? `${report[5]}. ` : '';
        response += `This is demo info — please call reception at ${RECEPTION_HELPLINE} to confirm.`;
        agent.add(response);
      } else {
        agent.add(`No lab report found for sample ID ${sampleId}. Please check the ID and try again, or call ${RECEPTION_HELPLINE}.`);
      }
    } catch (error) {
      agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
    }
  }

  async function getBilling(agent) {
    const service = agent.parameters.service;

    if (!service) {
      agent.add('Which service are you asking about? (consultation, lab, pharmacy, or inpatient)');
      return;
    }

    try {
      const data = await readSheet('billing!A:C');
      const billing = data.slice(1);
      const serviceInfo = billing.find(item => 
        item[0].toLowerCase().includes(service.toLowerCase())
      );

      if (serviceInfo) {
        const response = `${serviceInfo[0]} service: Typical cost ${serviceInfo[1]}. ${serviceInfo[2]}. This is demo info — please call reception at ${RECEPTION_HELPLINE} to confirm.`;
        agent.add(response);
      } else {
        agent.add(`I don't have billing information for ${service}. Please call ${RECEPTION_HELPLINE} for assistance.`);
      }
    } catch (error) {
      agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
    }
  }

  async function getFAQ(agent) {
    try {
      const data = await readSheet('faqs!A:B');
      const faqs = data.slice(1);
      const userQuestion = agent.query.toLowerCase();
      
      // Simple keyword matching for demo
      const matchingFAQ = faqs.find(faq => 
        userQuestion.includes(faq[0].toLowerCase())
      );

      if (matchingFAQ) {
        agent.add(`${matchingFAQ[1]} This is demo info — please call reception at ${RECEPTION_HELPLINE} to confirm.`);
      } else {
        agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
      }
    } catch (error) {
      agent.add(`I'm sorry, I don't have that info in the demo. Please call ${RECEPTION_HELPLINE} for help.`);
    }
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('Ask_Hospital_Hours', getHospitalHours);
  intentMap.set('Ask_Location', getLocation);
  intentMap.set('Department_Info', getDepartmentInfo);
  intentMap.set('Doctor_Availability', getDoctorAvailability);
  intentMap.set('Lab_Report_Status', getLabReportStatus);
  intentMap.set('Billing_Query', getBilling);
  intentMap.set('FAQ_General', getFAQ);

  agent.handleRequest(intentMap);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});