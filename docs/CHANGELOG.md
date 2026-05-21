# Changelog — I-FAQ Knowledge Base

บันทึกการเปลี่ยนแปลงระบบทุกเวอร์ชัน  
รูปแบบอ้างอิง: [Keep a Changelog](https://keepachangelog.com/th/1.0.0/)

> **วิธีอัปเดตเอกสารนี้:** เมื่อมีการแก้ไขหรือเพิ่มฟีเจอร์ใหม่ ให้เพิ่มรายการใต้หัวข้อ `[Unreleased]` ก่อน  
> เมื่อ Deploy จริงให้เปลี่ยน `[Unreleased]` เป็นหมายเลขเวอร์ชันและวันที่

---

## [Unreleased]

> รายการที่กำลังพัฒนาหรือยังไม่ได้ Deploy

---

## [1.3.0] — 19 พฤษภาคม 2568

### Fixed
- **Sidebar สถานะพับ/กางถูก Reset เมื่อ Navigate** — แก้โดยใช้ `sessionStorage` เก็บ state ของแต่ละโฟลเดอร์ใน `PortalSidebarSection` ข้ามการ Navigate ได้ (ไม่ Reset เมื่อ PublicLayout remount)
- **Section "File Portal" ยุบกลับทุกครั้งที่เปลี่ยนหน้า** — แก้โดย auto-expand เมื่อ pathname เริ่มต้นด้วย `/portal/*`
- **Folder ที่กางออกไว้ในโฟลเดอร์ย่อย ต้องกดใหม่ทุกครั้งหลัง Navigate** — แก้โดยโหลด children อัตโนมัติเมื่อ restore จาก sessionStorage

### Added
- คู่มือผู้ใช้ (`docs/user-guide.md`)
- คู่มือผู้ดูแลระบบ (`docs/admin-guide.md`)
- ไฟล์ Changelog นี้ (`docs/CHANGELOG.md`)

---

## [1.2.0] — 19 พฤษภาคม 2568

### Fixed
- **สิทธิ์หายหลังกด Sync** — แก้โดยเปลี่ยน Sync จากใช้ `deleteFolder()` (Hard Delete + Cascade ลบ FolderPermissions) เป็น `softDeleteFolder()` (ตั้ง `IsActive=0` เท่านั้น) — สิทธิ์ไม่หายอีก

### Added
- ฟังก์ชัน `softDeleteFolder(id)` ใน `folder.repository.js` — Soft Delete ใช้เฉพาะใน Sync
- Auto-Sync ทุก 5 นาที (`SYNC_INTERVAL_MINUTES=5`) ผ่าน `setInterval` ใน `app.js` — ไฟล์ใหม่ใน Shared Drive จะปรากฏเองโดยไม่ต้อง Sync ด้วยมือ

---

## [1.1.0] — 18 พฤษภาคม 2568

### Fixed
- **429 Too Many Requests** — เพิ่ม Rate Limit จาก 200 เป็น 3,000 req/15 นาที (`.env → RATE_LIMIT_MAX`)
- **LDAP ถูกเรียกทุก Request** — เพิ่ม In-Memory Auth Cache (TTL 5 นาที, keyed by `username:sha256(password)`) ใน `auth.js` ช่วยลด LDAP call ลงมาก
- **I-FAQ ค้นหา Internal Server Error** — แก้โดยสร้าง Full-Text Search Catalog + Index + Stored Procedures (`usp_SearchKnowledge`, `usp_SearchKnowledgeLike`) ใน MSSQL
- **Link ไฟล์ใน Search ชี้ไปที่ Raw API** — แก้ให้ใช้ React Router `<Link to="/portal/file/:id">` แทน `<a href="/api/...">`

### Added
- ค้นหา Portal Files จากหน้า Search (`SearchPage.jsx`) แสดงผล 2 ส่วน: I-FAQ และ File Portal พร้อมกัน
- `invalidateAuthCache(username)` export สำหรับล้าง Cache รายบุคคล

---

## [1.0.0] — มิถุนายน 2568 (Initial Release)

### Added
- ระบบ I-FAQ Knowledge Base พร้อมโครงสร้าง Level 1 / Level 2 / Knowledge Item
- File Portal — เชื่อมต่อ Shared Drive ด้วย AD Group Permissions
- Admin Panel — จัดการ Knowledge, Folder, Permissions, Sync
- Authentication ด้วย Active Directory (LDAP)
- Full-Text Search ภาษาไทย (MSSQL FTS)
- PDF Viewer และ Video Player ฝั่ง User
- Auto-Sync Shared Drive → Database

---

## คำแนะนำการอัปเดตเอกสาร

เมื่อมีการเปลี่ยนแปลงระบบในอนาคต ให้อัปเดต **3 ไฟล์** พร้อมกัน:

| ไฟล์ | อัปเดตเมื่อ |
|------|------------|
| `docs/CHANGELOG.md` | **ทุกครั้ง** ที่มีการเปลี่ยนแปลง |
| `docs/user-guide.md` | เมื่อพฤติกรรมที่ **ผู้ใช้เห็น** เปลี่ยนแปลง |
| `docs/admin-guide.md` | เมื่อขั้นตอนของ **Admin** เปลี่ยนแปลง |

### รูปแบบการเขียน Changelog

```markdown
## [X.Y.Z] — วัน เดือน ปี

### Added
- ฟีเจอร์ใหม่

### Changed
- ฟีเจอร์เดิมที่มีการปรับเปลี่ยน

### Fixed
- Bug ที่แก้ไข

### Removed
- ฟีเจอร์ที่ลบออก

### Security
- การแก้ไขด้านความปลอดภัย
```

### การกำหนดเลขเวอร์ชัน (Semantic Versioning)

| เปลี่ยนแปลง | เลขที่เพิ่ม | ตัวอย่าง |
|------------|-----------|---------|
| Bug fix เล็กน้อย | Patch (Z) | 1.2.0 → 1.2.1 |
| ฟีเจอร์ใหม่ (ไม่ Breaking) | Minor (Y) | 1.2.0 → 1.3.0 |
| เปลี่ยนแปลงใหญ่ / Breaking Change | Major (X) | 1.2.0 → 2.0.0 |
