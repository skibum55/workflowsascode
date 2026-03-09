# ├── .github/
# │   └── workflows/
# │       ├── 01_ci_dev.yml
# Phase 3: Automated Testing
# │       └── 02_cd_prod.yml      
# Phase 4: Fleet Promotion
# ├── config/
# │   └── manifest.json           
# Phase 1: Workflow-ID mapping
# ├── src/
# │   ├── workflows/
# │   │   ├── customer_v1.json    
# Phase 1: Standardized Templates
# │   │   └── customer_v2.json
# │   └── lib/
# │       ├── api_client.js       
# Phase 3&4: N8N REST Client
# │       └── utils.js            
# Phase 2: Version Injection
# ├── scripts/
# │   ├── deploy_nonprod.js       
# Phase 3: Deploy & Test
# │   └── rollback.js             
# Phase 4: Automated Recovery
# └── package.json                
# Dependencies