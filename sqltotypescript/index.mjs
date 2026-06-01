import { Client } from '@rmp135/sql-ts'

const config = {
  "client": "mssql",
    "connection": {
    "host": "lbkms-sqlserver.database.windows.net",
    "options": {
      "encrypt": true,
            // Time to wait for a connection to be established (ms)
      "connectionTimeout": 30000, 
      // Time to wait for a specific request/query to finish (ms)
      "requestTimeout": 600000000
    },
    // "encrypt": "true",
    "user": "interface",
    "password": "YourStrongPassword123!",
    "database" : "NexusCoreSK",
    "connectionTimeout": 300000000,
    "requestTimeout": 60000000,
    "pool": {
      "max": 10,
      "min": 0,
      "idleTimeoutMillis": 150000
    },
  },
  // "tables": ["FS.ActionDefinition"],
  "schemas": ["FS"],
  "filename": "DatabaseModels"
} // Config as before.

const definition = await Client
  .fromConfig(config)
  .fetchDatabase()
  .toTypescript()

const def2 = await Client.fromConfig(config).fetchDatabase()

console.log(definition.toString());