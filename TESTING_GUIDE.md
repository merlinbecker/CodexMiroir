# Testing Guide - Security Features

## Manual Testing Checklist

### 1. Test Local Development (No Key Required)

```bash
# Start the function app
npm start
```

1. Open browser: `http://localhost:7071/`
2. **Expected**: Username prompt appears
3. Enter username: `u_merlin`
4. **Expected**: Username is saved and timeline loads
5. Refresh page
6. **Expected**: No prompt, username loaded from localStorage
7. Open browser console
8. **Expected**: Function key status shows "⚠ Nicht gefunden (optional für lokale Entwicklung)"
9. Check Network tab
10. **Expected**: API calls go to `/api/timeline/u_merlin` without `?code=` parameter

### 2. Test Username Management

1. Change username in the UI input field
2. **Expected**: Username updates in localStorage
3. Click "Timeline laden"
4. **Expected**: Timeline loads for new user
5. Open DevTools → Application → Local Storage
6. **Expected**: `codexmiroir_userId` key exists with your username

### 3. Test Function Key Extraction (Query Parameter)

**Simulate production environment with function key:**

1. Open: `http://localhost:7071/?code=test_function_key_123`
2. **Expected**: 
   - Username prompt appears (if not in localStorage)
   - Function key status shows "✓ Vorhanden"
3. Open Network tab and load timeline
4. **Expected**: API calls include `?code=test_function_key_123` parameter
5. Check console: `console.log(window.Alpine.data.functionKey)`
6. **Expected**: Shows `test_function_key_123`

### 4. Test Function Key Extraction (Fragment)

1. Open: `http://localhost:7071/#code=test_function_key_456`
2. **Expected**: Function key status shows "✓ Vorhanden"
3. Open Network tab and load timeline
4. **Expected**: API calls include `?code=test_function_key_456` parameter

### 5. Test API Endpoints Locally

```bash
# All these should work locally without code parameter (authLevel ignored in local mode)

# Get Timeline
curl http://localhost:7071/api/timeline/u_merlin?dateFrom=2025-01-01&dateTo=2025-01-31

# Create Task
curl -X POST http://localhost:7071/api/tasks/u_merlin \
  -H "Content-Type: application/json" \
  -d '{"kind":"business","title":"Test Task","priority":3}'

# Get Task (replace task_id with actual ID from create response)
curl http://localhost:7071/api/tasks/u_merlin/task_[timestamp]-[random]

# Update Task
curl -X PUT http://localhost:7071/api/tasks/u_merlin/task_[id] \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Task","priority":1}'
```

### 6. Test Business/Personal Mode Toggle

1. Load timeline with both business and personal tasks
2. Toggle "Geschäftlich/Privat" switch
3. **Expected**: 
   - In Business mode: Only weekdays visible, only business tasks shown
   - In Private mode: Only weekends visible, only personal tasks shown
4. **Expected**: Theme changes (dark for business, light for private)

### 7. Test Static File Serving (No Auth)

```bash
# These should work without any key
curl http://localhost:7071/
curl http://localhost:7071/index.html
curl http://localhost:7071/app.js
curl http://localhost:7071/styles.css
```

**Expected**: All static files served successfully (200 OK)

## Production Testing (Azure)

### Prerequisites
1. Function App deployed to Azure
2. Master key obtained from Azure Portal

### Test Steps

1. **Get Master Key:**
   ```bash
   az functionapp keys list \
     --name your-function-app-name \
     --resource-group your-resource-group
   ```

2. **Test with Master Key:**
   - Open: `https://your-app.azurewebsites.net/?code=YOUR_MASTER_KEY`
   - **Expected**: App loads, username prompt appears
   - Enter username and test all features

3. **Test API Authorization:**
   ```bash
   # Without key - should fail with 401 Unauthorized
   curl https://your-app.azurewebsites.net/api/timeline/u_merlin
   
   # With key - should work
   curl "https://your-app.azurewebsites.net/api/timeline/u_merlin?code=YOUR_MASTER_KEY"
   ```

4. **Test Invalid Key:**
   - Open: `https://your-app.azurewebsites.net/?code=invalid_key`
   - Try to load timeline
   - **Expected**: API calls fail with 401 Unauthorized

## Security Verification

### ✅ Checklist

- [ ] All API endpoints require master key in production
- [ ] Static files are served without authentication
- [ ] Function key is extracted from URL
- [ ] Function key is passed in all API requests
- [ ] Username is stored in localStorage
- [ ] Username is loaded on app initialization
- [ ] Username prompt appears if not stored
- [ ] Username can be changed via UI
- [ ] Relative paths work correctly
- [ ] No hardcoded backend URLs in frontend
- [ ] Function key status is displayed in UI

### 🔒 Security Tests

1. **Test URL without key in production:**
   - Frontend should load (static files)
   - API calls should fail with 401
   - Error message should be visible in UI

2. **Test localStorage persistence:**
   - Enter username
   - Close browser
   - Reopen app
   - Username should be pre-filled

3. **Test key visibility:**
   - Check browser's Network tab
   - Function key should only appear in API requests
   - Key should be in query parameter, not body

## Common Issues

### Issue: "Username prompt appears on every refresh"
- **Cause**: localStorage disabled or browser in incognito mode
- **Solution**: Use normal browser mode

### Issue: "API calls fail with 401 in production"
- **Cause**: Missing or invalid function key
- **Solution**: Check URL contains `?code=YOUR_MASTER_KEY`

### Issue: "Function key status always shows warning"
- **Cause**: Key not in URL
- **Solution**: Add `?code=...` or `#code=...` to URL

### Issue: "Timeline doesn't load"
- **Cause**: No timeline data in database
- **Solution**: Run ensureDays function or timer to create day documents

## Browser Console Tests

Open DevTools console and run:

```javascript
// Check Alpine.js data
console.log('User ID:', Alpine.store('app').userId);
console.log('Function Key:', Alpine.store('app').functionKey);

// Check localStorage
console.log('Stored User:', localStorage.getItem('codexmiroir_userId'));

// Test API URL generation
console.log('API URL:', Alpine.store('app').apiUrl('api/timeline/u_merlin'));
```

## Next Steps After Testing

1. Document any issues found
2. Update error messages if needed
3. Consider adding analytics/monitoring
4. Set up Application Insights alerts for 401 errors
5. Document master key rotation procedure
