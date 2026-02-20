const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { N8N_URL, N8N_API_KEY } = process.env;
const OUTPUT_DIR = './workflows';
const MANIFEST_FILE = './manifest.yml';

// Keywords that usually indicate sensitive hardcoded data
const SENSITIVE_KEYS = ['password', 'apikey', 'token', 'secret', 'privatekey', 'auth', 'authorization', 'bearer', 'credential'];

const client = axios.create({
  baseURL: `${N8N_URL}/api/v1`,
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

/**
 * Recursively scans the JSON object and replaces secrets with placeholders
 */
function sanitizeJson(obj) {
  for (let key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeJson(obj[key]);
    } else if (typeof obj[key] === 'string') {
      const lowerKey = key.toLowerCase();
      const val = obj[key].trim();

      // 1. Identify Sensitive Keys (except if the value is an n8n expression {{...}})
      const isSensitiveKey = SENSITIVE_KEYS.some(s => lowerKey.includes(s));
      const isExpression = val.startsWith('{{') && val.endsWith('}}');

      if (isSensitiveKey && val.length > 0 && !isExpression) {
        obj[key] = `[PLACEHOLDER_SECRET]`;
      }

      // 2. Identify Certificate Material (PEM format)
      if (val.includes('-----BEGIN')) {
        obj[key] = `[PLACEHOLDER_CERTIFICATE]`;
      }
    }
  }
}

async function pullWorkflows() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const response = await client.get('/workflows?limit=100');
    const workflows = response.data.data;

    const manifestData = {
      source_instance: N8N_URL,
      last_sync: new Date().toISOString(),
      workflows: []
    };

    for (const wf of workflows) {
      const detail = await client.get(`/workflows/${wf.id}`);
      const data = detail.data.data;

      // --- NEW: SANITIZE DATA ---
      // We sanitize the 'nodes' array where parameters are stored
      sanitizeJson(data.nodes);
      // Also clear staticData (prevents leaking last-run sync IDs)
      data.staticData = null;

      const fileName = `${data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      manifestData.workflows.push({
        name: data.name,
        source_id: wf.id,
        file: fileName
      });

      // Remove instance-specific metadata
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ Saved & Sanitized: ${fileName}`);
    }

    fs.writeFileSync(MANIFEST_FILE, yaml.dump(manifestData));
    console.log(`✅ Manifest updated.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

pullWorkflows();