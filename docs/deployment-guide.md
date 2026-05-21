# Deployment Guide — File Portal

## Prerequisites

- Windows Server with IIS
- Node.js 18+ installed
- MSSQL Server (existing)
- Active Directory (existing)
- iisnode module installed on IIS

---

## Step 1: Run SQL Schema

Connect to your MSSQL database and run:

```sql
-- File: Back-end/SQL/portal.schema.sql
-- Creates: dbo.Folders, dbo.FolderPermissions, dbo.FileMetadata, dbo.PortalAuditLogs
-- Creates: dbo.sp_GetFolderTree stored procedure
```

---

## Step 2: Environment Variables

Add to your `.env` file:

```env
# Portal Settings
PORTAL_DRIVE_ROOT=D:\Shared          # Default root path for sync
PORTAL_SCAN_MAX_DEPTH=10             # Maximum folder scan depth

# Dev only (remove in production)
PORTAL_DEV_USER=john.doe             # Simulate Windows Auth user in dev
PORTAL_DEV_DOMAIN=domain             # Simulate Windows Auth domain in dev
```

---

## Step 3: IIS Configuration

### Enable Windows Authentication

In IIS Manager:
1. Select your site/application
2. Authentication → Enable **Windows Authentication**
3. Authentication → Disable **Anonymous Authentication**

### Configure iisnode (web.config)

Ensure your `web.config` passes the Windows Auth user:

```xml
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server/app.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server/app.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}" />
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
          </conditions>
          <action type="Rewrite" url="server/app.js" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <authentication>
        <windowsAuthentication enabled="true" />
        <anonymousAuthentication enabled="false" />
      </authentication>
    </security>
    <iisnode watchedFiles="web.config;*.js" />
  </system.webServer>
</configuration>
```

### IIS Header Forwarding

IIS automatically sets `LOGON_USER` server variable.
To forward it as an HTTP header, add a custom header rule in URL Rewrite:

```xml
<serverVariables>
  <set name="HTTP_X_AUTH_USER" value="{LOGON_USER}" />
</serverVariables>
```

This makes `X-Auth-User: DOMAIN\username` available to Node.js.

---

## Step 4: File System Access

The Node.js server (iisnode) runs under the IIS Application Pool identity.
That identity must have **Read** access to the Shared Drive.

```powershell
# Grant read access to the app pool identity
icacls "D:\Shared" /grant "IIS APPPOOL\YourAppPool:(OI)(CI)R" /T
```

For UNC paths (\\\\fileserver\\dept):
- Configure the App Pool to run under a domain service account
- That service account must have read access on the file server

---

## Step 5: Build Frontend

```bash
cd Font-End
npm install
npm run build
# Output: Font-End/dist/
```

Copy `dist/` contents to your IIS wwwroot or configure IIS to serve from `Font-End/dist/`.

---

## Step 6: Verify

1. Open browser → navigate to your portal URL
2. Should automatically detect your Windows login (no login prompt)
3. Navigate to `/portal` → should see File Portal (or "ไม่พบโฟลเดอร์" if no permissions set yet)
4. Admin login → go to `/administrator/portal/sync` → trigger first sync
5. Go to `/administrator/portal/folders` → verify folders imported
6. Go to `/administrator/portal/permissions/:id` → assign AD groups to folders
7. Test with a domain user account

---

## Step 7: Scheduler (Optional)

For automatic sync, create a Windows Scheduled Task:

```powershell
# PowerShell script to trigger sync via API
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/portal/admin/sync" `
  -Method POST `
  -Headers @{ Authorization = "Basic $([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('admin:password')))" } `
  -ContentType "application/json" `
  -Body '{"rootPath":"D:\\Shared"}'
```

Schedule: Daily at 2:00 AM or after any drive changes.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 401 on /api/portal/folders/tree | Check IIS Windows Auth enabled; check X-Auth-User header forwarding |
| Empty folder tree | Run sync first; check AD group names match exactly (case-insensitive) |
| Sync fails | Check app pool identity has read access to the drive |
| AD groups not found | Check LDAP config in `config/ldap.js`; verify `getUserGroups()` works |
| Dev mode: 401 | Set `PORTAL_DEV_USER=youruser` in `.env` |
