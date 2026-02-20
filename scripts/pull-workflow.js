const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { N8N_URL, N8N_API_KEY } = process.env;
const OUTPUT_DIR = './workflows'; // The common folder

const client = axios.create({
  baseURL: `${N8N_URL}/api/v1`,
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

async function pullWorkflows() {
  try {
    // 1. Create directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log(`Fetching workflows from ${N8N_URL}...`);
    
    // 2. Fetch all workflows (Note: n8n API uses pagination, default limit is 50)
    const response = await client.get('/workflows?limit=100');
    const workflows = response.data.data;

    for (const wf of workflows) {
      // 3. Fetch full workflow detail (to get nodes and connections)
      const detail = await client.get(`/workflows/${wf.id}`);
      const data = detail.data.data;

      // 4. Sanitize JSON: Remove instance-specific metadata
      // This ensures Git only tracks logic changes, not timestamp changes
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      delete data.active; // Optional: keeps files "deactivated" by default in the repo

      const fileName = `${data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ Saved: ${fileName}`);
    }

    console.log('Finished pulling workflows.');
  } catch (error) {
    console.error('Error pulling workflows:', error.message);
    process.exit(1);
  }
}

pullWorkflows();