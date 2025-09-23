# Azure Functions Deployment Guide

## Prerequisites

1. **Azure Account**: Active Azure subscription
2. **Azure CLI**: Installed and configured (`az login`)
3. **Azure Functions Core Tools**: v4 installed (`npm install -g azure-functions-core-tools@4 --unsafe-perm true`)
4. **Node.js**: Version 18+ 

## Step 1: Create Azure Resources

### 1.1 Create Resource Group
```bash
az group create --name codex-miroir-rg --location "West Europe"
```

### 1.2 Create Storage Account
```bash
az storage account create \
  --name codexmiroirstorage \
  --resource-group codex-miroir-rg \
  --location "West Europe" \
  --sku Standard_LRS
```

### 1.3 Get Storage Connection String
```bash
az storage account show-connection-string \
  --name codexmiroirstorage \
  --resource-group codex-miroir-rg \
  --query connectionString \
  --output tsv
```

### 1.4 Create Blob Container
```bash
az storage container create \
  --name codex-miroir \
  --connection-string "<CONNECTION_STRING>"
```

### 1.5 Create Function App
```bash
az functionapp create \
  --resource-group codex-miroir-rg \
  --consumption-plan-location "West Europe" \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name codex-miroir-fn \
  --storage-account codexmiroirstorage
```

## Step 2: Configure Environment Variables

Set the required environment variables in the Function App:

```bash
# Set Azure Blob Storage connection string
az functionapp config appsettings set \
  --name codex-miroir-fn \
  --resource-group codex-miroir-rg \
  --settings AZURE_BLOB_CONN="<CONNECTION_STRING>"

# Set blob container name
az functionapp config appsettings set \
  --name codex-miroir-fn \
  --resource-group codex-miroir-rg \
  --settings BLOB_CONTAINER="codex-miroir"

# Set API key (generate a secure key)
az functionapp config appsettings set \
  --name codex-miroir-fn \
  --resource-group codex-miroir-rg \
  --settings API_KEY="your-secure-api-key-here"
```

## Step 3: Deploy Function

### 3.1 Install Dependencies
```bash
cd codex-miroir-fn
npm install
```

### 3.2 Deploy to Azure
```bash
func azure functionapp publish codex-miroir-fn
```

## Step 4: Test Deployment

### 4.1 Get Function URL
The deployment will output the function URL. It should look like:
```
https://codex-miroir-fn.azurewebsites.net/api/codex
```

### 4.2 Test API Endpoints

#### Create a test task:
```bash
curl -X POST "https://codex-miroir-fn.azurewebsites.net/api/codex?action=createTask" \
  -H "x-api-key: your-secure-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "list": "pro",
    "id": "T-001",
    "title": "Test Task",
    "created_at_iso": "2025-09-23T10:00:00Z",
    "scheduled_slot": "2025-W39-Tue-AM",
    "category": "testing"
  }'
```

#### Get task report:
```bash
curl -X GET "https://codex-miroir-fn.azurewebsites.net/api/codex?action=report" \
  -H "x-api-key: your-secure-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"list": "pro"}'
```

## Step 5: Verify Storage

Check that files are created in Azure Blob Storage:

```bash
az storage blob list \
  --container-name codex-miroir \
  --connection-string "<CONNECTION_STRING>" \
  --output table
```

You should see:
- `pro/current.md`
- `pro/tasks/2025/2025-09-23--T-001-test-task.md`

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check API key configuration
2. **500 Internal Server Error**: Check Azure Blob connection string
3. **Function not found**: Verify deployment completed successfully

### Check Function Logs
```bash
func azure functionapp logstream codex-miroir-fn
```

### Check Application Settings
```bash
az functionapp config appsettings list \
  --name codex-miroir-fn \
  --resource-group codex-miroir-rg
```

## Security Considerations

1. **API Key**: Use a strong, randomly generated API key
2. **CORS**: Configure CORS settings if needed for web frontend
3. **Authentication**: Consider Azure AD integration for production
4. **Network**: Restrict network access if needed

## Monitoring

### Enable Application Insights
```bash
az functionapp config appsettings set \
  --name codex-miroir-fn \
  --resource-group codex-miroir-rg \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="<INSTRUMENTATION_KEY>"
```

### View Metrics
- Azure Portal > Function App > Monitoring
- Check request rates, response times, and error rates

## Cost Optimization

- **Consumption Plan**: Pay only for executions
- **Storage**: Use Standard_LRS for cost efficiency
- **Monitoring**: Use built-in metrics to track usage

## Backup Strategy

### Storage Backup
```bash
# Create storage account for backups
az storage account create \
  --name codexmiroirbackup \
  --resource-group codex-miroir-rg \
  --location "West Europe" \
  --sku Standard_LRS

# Enable blob versioning (recommended)
az storage account blob-service-properties update \
  --account-name codexmiroirstorage \
  --enable-versioning true
```

### Function Code Backup
- Use Git repository for version control
- Azure DevOps or GitHub Actions for CI/CD

## Next Steps After Deployment

1. **Test all API endpoints** with real data
2. **Monitor performance** and adjust if needed
3. **Set up alerts** for errors and performance issues
4. **Plan Phase 2**: Voice command processing and AI integration
5. **Begin frontend migration** to use new API endpoints