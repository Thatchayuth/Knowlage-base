# Permission Model — File Portal

## Core Concept

Folder visibility is controlled by mapping **Active Directory Groups** to folders.
Users see only the folders they have permission to access.

---

## Permission Levels

| Flag      | Meaning                                    |
|-----------|--------------------------------------------|
| CanView   | User can see the folder and its files      |
| CanUpload | (future) User can upload files             |
| CanDelete | (future) User can delete files             |

Currently enforced: **CanView** only (Upload/Delete reserved for future feature).

---

## AD Group Format

AD Groups are stored as **lowercase CN names** (not full DN):

```
Stored in DB:    hr-staff
Not stored as:   CN=HR-Staff,OU=Groups,DC=domain,DC=com
```

`adGroup.service.js` normalizes all group names to lowercase before comparison.

---

## Permission Resolution Flow

```
1. Request arrives → windowsAuth.middleware reads X-Auth-User (IIS)
   → e.g.  DOMAIN\john.doe

2. adGroup.service.getGroups('john.doe')
   → Check cache ('adgroups:john.doe')
   → Cache miss → ldapService.getUserGroups('john.doe')
   → Returns: ['hr-staff', 'domain users', 'it-helpdesk']
   → Stored in cache for 5 minutes

3. folder.service.getFilteredTree(userGroups)
   → Load all folders (flat list, cached 2min)
   → Load permission map (Map<folderId, groups[]>, cached 2min)
   → Build nested tree from flat
   → treeBuilder.filterTreeByPermission(tree, ['hr-staff', 'domain users', ...], permMap)

4. filterTreeByPermission algorithm:
   For each node:
     a. hasDirectAccess = permMap.get(node.Id) has any group in userGroups
     b. Recurse into children → filteredChildren (recursive)
     c. Keep node IF: hasDirectAccess OR filteredChildren.length > 0
     d. Attach _hasDirectAccess flag for UI rendering
   
   Result: User sees only folders they have access to (or need to navigate through)
```

---

## Parent Visibility Rule

If a user has access to **child folder only**, the **parent folder is shown** for navigation.
The parent is marked `_hasDirectAccess: false` and the UI shows a 🔒 icon.

**Example:**

```
Folder tree:
  HR                  (no direct permission for user)
  └── Salary          (user has CanView)
       └── 2025       (user has CanView)

Result for user:
  HR 🔒              (shown for navigation, _hasDirectAccess: false)
  └── Salary ✅      (shown, has direct access)
       └── 2025 ✅   (shown)
```

---

## Permission Inheritance

The system does **NOT** use automatic inheritance.
Each folder's permissions are set independently.

If you want all subfolders to be accessible, you must explicitly set permissions for each.

This is intentional for maximum control granularity.

---

## Admin Bypass

Admin users (members of `admin-dt` AD group) bypass all folder permission checks.
Admin routes call `folder.service.getAllForAdmin()` which returns the full unfiltered tree.

In `permission.middleware.js` and `folder.service.js`, admin callers receive `userGroups: ['*']`
which is treated as "bypass all permission checks".

---

## NTFS as Security Layer

The database permissions control **visibility** only.
Actual file access is protected by **NTFS permissions** on the filesystem.

If a user somehow bypasses the web portal and attempts direct file access, the Windows NTFS
permissions still protect the files (the Node.js server runs under a service account with
access only to configured paths).

Security model:
```
Web Layer:   Controls what the user SEES (folder visibility)
NTFS Layer:  Controls actual FILE ACCESS (real security)
```
