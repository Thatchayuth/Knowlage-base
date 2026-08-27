# คู่มือนำโค้ด Login AD (LDAP) ไปใช้กับ Project อื่น

สรุปไฟล์และขั้นตอนที่ต้องใช้ ถ้าต้องการยกระบบ Login ผ่าน Active Directory
จากโปรเจกต์ KM Portal ไปใช้ใน project Node.js/Express อื่น

---

## 1. ภาพรวมการทำงาน (Flow)

```
Front-end                Back-end (Express)                    AD Server
─────────                ──────────────────                    ─────────
login(user, pass)
  │ btoa("user:pass")
  │ GET /api/auth/me
  │ Authorization: Basic xxxx
  ▼
            authenticateAD (middleware/auth.js)
              │ decode Basic Auth
              │ เช็ค cache (5 นาที) → hit = ข้าม LDAP
              ▼
            authenticateUser (services/ldapService.js)
              │ 1) bind ด้วย service account ──────────────►  LDAP bind
              │ 2) search หา DN ของ user จาก sAMAccountName ►  LDAP search
              │ 3) bind ด้วย user DN + password ───────────►  LDAP bind (ตรวจรหัส)
              ▼
            ได้ { username, displayName, email, groups[] }
              │ เช็ค group → กำหนด role
              ▼
            req.user → controller ส่ง profile กลับ
```

---

## 2. ไฟล์ที่ต้องคัดลอก (Core — ขาดไม่ได้)

| ไฟล์ | หน้าที่ |
|------|---------|
| `Back-end/server/config/ldap.js` | อ่านค่า config AD จาก `.env` (URL, baseDn, bind account, TLS) |
| `Back-end/server/services/ldapService.js` | ตัวคุยกับ AD จริง: `authenticateUser()`, `getUserGroups()`, `isInGroup()` |
| `Back-end/server/middlewares/auth.js` | Express middleware `authenticateAD` + cache รหัสผ่าน 5 นาที + `authorizeGroup()` |

## 3. ไฟล์เสริม (Optional — เลือกตามที่ project ปลายทางต้องการ)

| ไฟล์ | เอาไปด้วยเมื่อ |
|------|----------------|
| `Back-end/server/controllers/authController.js` | ต้องการ endpoint `GET /api/auth/me` คืน profile หลัง login (แนะนำให้เอา) |
| `Back-end/server/routes/api.js` (เฉพาะบรรทัด route auth) | ตัวอย่างการผูก route: `router.get('/auth/me', authenticateAD, getCurrentUser)` |
| `Back-end/server/middlewares/windowsAuth.middleware.js` | ใช้ IIS Windows Authentication (SSO ไม่ต้องกรอกรหัส) — อ่าน header `x-auth-user` จาก IIS |
| `Back-end/server/services/adGroup.service.js` | ใช้คู่กับ windowsAuth — ดึง AD groups พร้อม cache 5 นาที |
| `Back-end/server/services/cache.service.js` | dependency ของ adGroup.service |

> ถ้า project ปลายทางเป็น login แบบกรอก username/password ธรรมดา
> ใช้แค่ 3 ไฟล์ core + authController ก็พอ ไม่ต้องเอากลุ่ม windowsAuth

## 4. Dependencies ที่ต้องติดตั้ง

```bash
npm install ldapjs@^3.0.7 dotenv
```

## 5. Environment Variables ที่ต้องตั้ง (`.env`)

```env
# LDAP / Active Directory
LDAP_URL=ldap://your-domain-controller:389      # หรือ ldaps://...:636
LDAP_BASE_DN=DC=yourdomain,DC=com
LDAP_BIND_DN=service_account@yourdomain.com     # ใช้ Service Account เท่านั้น
LDAP_BIND_PASSWORD=your_service_account_password
LDAP_ADMIN_GROUP=ICT                            # AD group ที่ถือว่าเป็น admin

LDAP_TIMEOUT=5000
LDAP_CONNECT_TIMEOUT=5000
LDAP_IDLE_TIMEOUT=60000

# ถ้าใช้ LDAPS + ต้อง verify cert
# LDAP_TLS_CA_CERT=/path/to/internal-ca.pem
```

⚠️ ข้อควรระวังใน `config/ldap.js`: ถ้าใช้ `ldaps://` แต่**ไม่ได้**ตั้ง `LDAP_TLS_CA_CERT`
โค้ดจะตั้ง `rejectUnauthorized: false` (ไม่ verify cert) — production ควรใส่ CA cert เสมอ

## 6. สิ่งที่ต้องแก้ในไฟล์ที่คัดลอกไป

ไฟล์เหล่านี้อ้างถึง module อื่นของโปรเจกต์เดิม ต้องตัดหรือแทนที่:

### `middlewares/auth.js`
- `require('../services/logger')` → แทนด้วย logger ของ project ใหม่ หรือ `console`
- `require('../repositories/syncUser.repository')` → **ลบทิ้ง** พร้อมบล็อกเช็ค role `syncuser`
  (บรรทัด ~98–101) เหลือแค่ `user.role = isAdmin ? 'admin' : 'readonly'`
- `authenticateADother()` → endpoint ทดสอบ ไม่จำเป็น ลบได้

### `services/ldapService.js`
- `require('./logger')` → แทนด้วย logger ของ project ใหม่ หรือ `console.error`

### `controllers/authController.js`
- `require('../services/logger')` → เช่นเดียวกัน

## 7. วิธีผูก Route ใน Project ใหม่

```js
const express = require('express');
const { authenticateAD, authorizeGroup } = require('./middlewares/auth');
const { getCurrentUser } = require('./controllers/authController');

const router = express.Router();

// Endpoint สำหรับ login / ตรวจ session
router.get('/auth/me', authenticateAD, getCurrentUser);

// ตัวอย่าง route ที่ต้อง login
router.get('/data', authenticateAD, myController);

// ตัวอย่าง route เฉพาะ admin (ต้องอยู่ใน AD group ที่กำหนด)
router.get('/admin/xxx', authenticateAD, authorizeGroup('admin-dt'), adminController);

module.exports = router;
```

## 8. ฝั่ง Front-end เรียกใช้ยังไง

ระบบนี้ใช้ **HTTP Basic Auth** (ไม่มี token/JWT) — ทุก request ต้องแนบ header:

```js
// login: เก็บ credentials แล้วลองยิง /auth/me
export const login = (username, password) => {
  const encoded = btoa(`${username}:${password}`);
  sessionStorage.setItem('credentials', encoded);
  return fetch('/api/auth/me', {
    headers: { Authorization: `Basic ${encoded}` },
  }).then(r => {
    if (!r.ok) { sessionStorage.removeItem('credentials'); throw new Error('Login failed'); }
    return r.json();   // { username, displayName, email, groups, role }
  });
};

// ทุก request หลัง login ต้องแนบ header เดิม (ดูตัวอย่าง interceptor ใน
// Font-End/src/services/axios.js ของโปรเจกต์นี้)
```

## 9. สิ่งที่ควรรู้เพิ่มเติม

- **Cache รหัสผ่าน 5 นาที** (`auth.js`): เก็บ SHA-256 ของ password ใน memory
  เพื่อลดการยิง LDAP ทุก request — ถ้า user เปลี่ยนรหัสใน AD จะยังใช้รหัสเก่าได้สูงสุด 5 นาที
  เรียก `invalidateAuthCache(username)` เพื่อล้างได้
- **Error code 49** จาก LDAP = รหัสผ่านผิด → ระบบแปลงเป็น `Invalid credentials` (HTTP 401)
- **AD server ล่ม/ติดต่อไม่ได้** → ตอบ HTTP 503 `AUTH_UNAVAILABLE`
- `_escapeLdap()` ใน ldapService ป้องกัน LDAP injection แล้ว — อย่าตัดออก
- role ที่ได้: `admin` (อยู่ใน `LDAP_ADMIN_GROUP`) / `readonly` (อื่นๆ)
