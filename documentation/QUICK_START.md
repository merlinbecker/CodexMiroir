# Quick Start Guide

## Für Nutzer

### Timeline anzeigen

1. **URL öffnen**:
   ```
   https://your-app.azurewebsites.net/codex?format=html
   ```

2. **Das war's** - Timeline wird angezeigt

### Tasks verwalten (Git-basiert)

Tasks werden über Git verwaltet, nicht über die UI:

1. **Task erstellen**:
   ```bash
   cd codex-miroir/tasks/
   vim 0042.md  # Neue Task-Datei
   git add 0042.md
   git commit -m "Add task 0042"
   git push
   ```

2. **Task abschließen**:
   ```bash
   vim 0042.md  # status: abgeschlossen
   git commit -am "Complete task 0042"
   git push
   ```

3. **Timeline aktualisiert sich automatisch** via GitHub Webhook

### Changing Your Username

If you need to change your username:
1. Update it in the "Benutzername" field
2. The change is saved automatically
3. Click "Timeline laden" to reload with the new username

### Troubleshooting

**"Benutzername erforderlich" error**
- You must enter a username to use the app
- Make sure you're not using private/incognito mode (username won't persist)

**"Unauthorized" or 401 errors**
- Your URL might be missing the function key
- Contact your administrator for a new URL with the key

**Timeline doesn't load**
- Check that you entered a valid username
- Make sure you're using the URL with `?code=...`
- Check your internet connection

---

## For Developers

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/merlinbecker/CodexMiroir.git
   cd CodexMiroir
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure local settings**

   Create `local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "COSMOS_CONNECTION_STRING": "your-cosmos-connection-string",
       "COSMOS_DB": "codexmiroir",
       "COSMOS_TIMELINE": "timeline",
       "COSMOS_TASKS": "tasks",
       "USERS_CSV": "u_merlin",
       "DAY_HORIZON": "30"
     }
   }
   ```

4. **Start the function app**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:7071/
   ```

   Note: Function key is not required locally

### Deploying to Azure

1. **Deploy the function app**
   ```bash
   func azure functionapp publish your-function-app-name
   ```

2. **Configure settings in Azure**
   ```bash
   az functionapp config appsettings set \
     --name your-function-app-name \
     --resource-group your-resource-group \
     --settings \
       "COSMOS_CONNECTION_STRING=your-connection-string" \
       "COSMOS_DB=codexmiroir" \
       "COSMOS_TIMELINE=timeline" \
       "COSMOS_TASKS=tasks" \
       "USERS_CSV=u_merlin" \
       "DAY_HORIZON=30"
   ```

3. **Get the master key**
   ```bash
   az functionapp keys list \
     --name your-function-app-name \
     --resource-group your-resource-group
   ```

   Or via Azure Portal:
   - Navigate to your Function App
   - Go to "Functions" → "App keys"
   - Copy the "default" master key

4. **Share URL with users**
   ```
   https://your-function-app.azurewebsites.net/?code=YOUR_MASTER_KEY
   ```

### Testing

**Manual testing:**
```bash
npm start
# Open http://localhost:7071/ in browser
# Follow the testing guide in TESTING_GUIDE.md
```

**Syntax validation:**
```bash
# Check all source files
for file in src/*.js; do node --check "$file"; done
for file in public/*.js; do node --check "$file"; done
```

**Unit tests:**
```bash
npm test
```

### Key Files

| File | Purpose |
|------|---------|
| `src/*.js` | Backend Azure Functions (API endpoints) |
| `public/app.js` | Frontend logic (key extraction, API calls) |
| `public/index.html` | Frontend UI |
| `host.json` | Function app configuration |
| `local.settings.json` | Local development settings (not in git) |

---

## Security Checklist

### For Administrators

- [ ] Master key is kept secure
- [ ] Master key is shared only via secure channels (not email)
- [ ] HTTPS is enabled (automatic with Azure)
- [ ] Function key is rotated regularly
- [ ] Access logs are monitored
- [ ] Backup of master key exists in secure location

### For Developers

- [ ] Never commit `local.settings.json` to git
- [ ] Never hardcode function keys in code
- [ ] Always use HTTPS in production
- [ ] Test with different usernames
- [ ] Verify key extraction works
- [ ] Check localStorage persistence

---

## Common Scenarios

### Scenario 1: New User Setup

1. User receives URL: `https://app.com/?code=KEY`
2. User opens URL
3. Browser prompt: "Bitte geben Sie Ihren Benutzernamen ein"
4. User enters: `u_john`
5. App loads timeline for `u_john`
6. Username saved in localStorage

### Scenario 2: Returning User

1. User opens URL: `https://app.com/?code=KEY`
2. App loads automatically
3. Username loaded from localStorage (`u_john`)
4. Timeline displayed immediately
5. No prompt needed

### Scenario 3: Key Rotation

1. Administrator generates new master key in Azure
2. Old URLs stop working
3. Administrator shares new URL with users
4. Users update their bookmarks
5. Usernames remain saved in localStorage

### Scenario 4: Username Change

1. User changes username in UI from `u_john` to `u_jane`
2. App saves `u_jane` to localStorage
3. User clicks "Timeline laden"
4. Timeline loads for `u_jane`
5. Future visits use `u_jane` automatically

---

## Support Resources

| Resource | Link |
|----------|------|
| **Architecture & Deployment** | [arc42.md](./arc42.md) |
| **Security Setup** | [SECURITY_SETUP.md](./SECURITY_SETUP.md) |
| **Testing Guide** | [TESTING_GUIDE.md](./TESTING_GUIDE.md) |
| **Implementation Details** | [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) |

---

## FAQ

**Q: Do I need to configure anything in the frontend?**  
A: No! The frontend automatically uses relative paths and extracts the key from the URL.

**Q: What if I lose my username?**  
A: Just clear your browser's localStorage or use a different browser. You'll be prompted again.

**Q: Can multiple users use the same master key?**  
A: Yes! Each user has their own username for data separation.

**Q: How do I change the master key?**  
A: Generate a new key in Azure Portal and share the new URL with users.

**Q: Is the username a password?**  
A: No, it's just a user identifier. All security comes from the master key.

**Q: What happens if I use incognito mode?**  
A: You'll be prompted for username every time (localStorage doesn't persist).

**Q: Can I have multiple usernames?**  
A: Use different browsers or profiles, each will store its own username.

**Q: Is my data secure?**  
A: Yes! All API calls require the master key, and HTTPS is enforced in production.

---

## Need Help?

1. Check the [TESTING_GUIDE.md](./TESTING_GUIDE.md) for common issues
2. Review the [SECURITY_SETUP.md](./SECURITY_SETUP.md) for deployment help
3. See [arc42.md](./arc42.md) for architecture and how it works
4. Contact your system administrator

---

**Last Updated:** January 2025  
**Version:** 2.0 (Security Update)