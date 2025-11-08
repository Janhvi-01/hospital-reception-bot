# Hospital Reception Chatbot Prototype

A complete, deployable prototype of a hospital reception chatbot for college demo. Built with Dialogflow ES, Node.js webhook, Google Sheets data storage, and a simple web chat interface.

## Architecture

- **Dialogflow ES**: Natural Language Understanding and conversation management
- **Node.js/Express Webhook**: Handles business logic and Google Sheets integration
- **Google Sheets**: Mock data storage (read-only)
- **Static Web Interface**: Simple chat widget for demonstration

## Quick Start

### Prerequisites
- Node.js 14+
- Google Cloud Platform account
- Google Sheets account

### 1. Setup Google Sheets

1. Create a new Google Sheet
2. Import the CSV files from `/sheets` directory as separate tabs
3. Share the sheet with your service account email (see next step)
4. Note the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

### 2. Setup Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Download the JSON key file
5. Share your Google Sheet with the service account email

### 3. Setup Dialogflow Agent

#### Option A: Import from CSV (Manual)
Use the `dialogflow_agent_export/intents.csv` file to manually create intents in Dialogflow Console.

#### Option B: Step-by-step Creation
1. Create new Dialogflow ES agent named "HospitalReceptionBot"
2. For each intent in the CSV:
   - Create new intent with specified name
   - Add training phrases
   - Enable webhook for webhook-enabled intents
   - Add static responses where specified

### 4. Deploy Webhook

#### Local Development
```bash
cd webhook
cp .env.example .env
# Edit .env with your values
npm install
npm start