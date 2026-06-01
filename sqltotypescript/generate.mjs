// generate-interfaces.js
// const mssql = require("mssql");
import mssql from 'mssql';
// const fs = require("fs");
import fs from 'node:fs';
// const path = require("path");
import path from 'node:path';
import { Client } from '@rmp135/sql-ts';

// Try to load @rmp135/sql-ts (the most common "sql-ts" package on npm)
// let sqlts;
// try {
//   sqlts = require("@rmp135/sql-ts");
// } catch {
//   try {
//     sqlts = require("sql-ts");
//   } catch {
//     console.error(
//       'Could not find a sql-ts package. Install it with:\n  npm install @rmp135/sql-ts mssql'
//     );
//     process.exit(1);
//   }
// }

// ──────────────────────────────────────────────
//  CONFIGURATION — edit these to match your env
// ──────────────────────────────────────────────
const DB_CONFIG = {
  server: "lbkms-sqlserver.database.windows.net",
  port: 1433,
  database: "NexusCoreSK",
  user: "interface",
  password: "YourStrongPassword123!",
  options: {
    encrypt: true, // use true for Azure / TLS-required setups
    trustServerCertificate: true, // use true for local dev / self-signed certs
  },
};

const SCHEMA_NAME = "FS";
const OUTPUT_DIR = path.join(".", "generated", "interfaces");

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────

/**
 * Query the database for every base table in the target schema.
 */
async function getTableNames(pool) {
  const result = await pool
    .request()
    .input("schema", mssql.NVarChar, SCHEMA_NAME).query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = @schema
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

  return result.recordset.map((row) => row.TABLE_NAME);
}

/**
 * Use sql-ts to generate TypeScript interfaces for a set of tables.
 * Returns the full TypeScript source string.
 */
async function generateInterface(tableName) {
  // sql-ts (via knex under the hood) expects "host" not "server"
  const knexConnection = {
    host: DB_CONFIG.server,
    port: DB_CONFIG.port || 1433,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
  };

  // Merge any extra mssql options into the knex connection
  if (DB_CONFIG.options) {
    knexConnection.options = DB_CONFIG.options;
  }

  const config = {
    client: "mssql",
    connection: knexConnection,
    // Limit to the tables we discovered in the target schema
    tables: [`${SCHEMA_NAME}.${tableName}`],
    // Naming conventions (adjust to taste)
    tableNameCasing: "pascal", // PascalCase interface names
    singularTableNames: false, // keep plural table names as-is
    filename: "interfaceName", // property naming strategy
    typeMap: {
      // override any DB→TS type mappings you need
      // e.g. 'uniqueidentifier': 'string',
    },
  };

  const definition = await Client
  .fromConfig(config)
  .fetchDatabase()
  .toTypescript()

//   return sqlts.Client.fetchDatabase().toTypeScript(config);
  return definition;
}

/**
 * Parse a combined .ts string that contains multiple `export interface`
 * blocks and split it into { interfaceName: source } entries so each
 * table can live in its own file.
 */
function splitInterfaces(tsSource) {
  const interfaces = {};
  // Match each "export interface <Name> { … }" block (non-greedy)
  const regex = /export\s+interface\s+(\w+)\s*\{[\s\S]*?\n\}/g;
  let match;
  while ((match = regex.exec(tsSource)) !== null) {
    interfaces[match[1]] = match[0];
  }
  return interfaces;
}

/**
 * Extract the first interface name from a TS source string.
 */
function extractInterfaceName(tsSource) {
  const match = tsSource.match(/export\s+interface\s+(\w+)/);
  return match ? match[1] : null;
}

/**
 * Ensure a directory exists (recursive).
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ──────────────────────────────────────────────
//  MAIN
// ──────────────────────────────────────────────
async function main() {
  let pool;

  try {
    // 1. Connect ────────────────────────────────────
    console.log(`⏳ Connecting to ${DB_CONFIG.server}/${DB_CONFIG.database} …`);
    pool = await mssql.connect(DB_CONFIG);
    console.log("✅ Connected.\n");

    // 2. Discover tables ────────────────────────────
    const tableNames = await getTableNames(pool);

    if (tableNames.length === 0) {
      console.log(`⚠️  No tables found in schema "${SCHEMA_NAME}".`);
      return;
    }

    console.log(
      `📋 Found ${tableNames.length} table(s) in schema "${SCHEMA_NAME}":`
    );
    tableNames.forEach((t) => console.log(`   • ${t}`));
    console.log();

    // 3. Generate & write each interface one at a time ─
    ensureDir(OUTPUT_DIR);
    const generatedNames = [];

    console.log("🛠  Generating TypeScript interfaces …\n");

    for (const tableName of tableNames) {
      process.stdout.write(`   ${tableName} … `);

      // Generate the interface for this single table
      const tsSource = await generateInterface(tableName);

      // Pull the interface name from the generated source
      const interfaceName = extractInterfaceName(tsSource);

      if (!interfaceName) {
        console.log("⚠️  no interface found in output, skipping");
        continue;
      }

      // 4a. Write individual file for this interface
      const filePath = path.join(OUTPUT_DIR, `${interfaceName}.ts`);
      fs.writeFileSync(filePath, tsSource + "\n", "utf-8");

      generatedNames.push(interfaceName);
      console.log(`✅  → ${filePath}`);
    }

    // 4b. Write a barrel re-export index
    if (generatedNames.length > 0) {
      const barrelLines = generatedNames
        .map((n) => `export * from './${n}';`)
        .join("\n");
      const barrelPath = path.join(OUTPUT_DIR, "index.ts");
      fs.writeFileSync(barrelPath, barrelLines + "\n", "utf-8");
      console.log(`\n📦 Barrel file → ${barrelPath}`);
    }

    console.log(`\n🎉 Done! ${generatedNames.length} interface(s) generated.`);
  } catch (err) {
    console.error("\n❌ Error:", err.message || err);
    if (err.code) console.error("   Code:", err.code);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

main();
