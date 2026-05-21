# คู่มือการจัดการระบบ I-FAQ Knowledge Base (สำหรับผู้ดูแลระบบ)

> **เวอร์ชัน:** 1.0  
> **อัปเดตล่าสุด:** 19 พฤษภาคม 2568  
> **เหมาะสำหรับ:** Admin ที่มีบัญชีในกลุ่ม AD `ICT` หรือกลุ่มที่กำหนดใน `LDAP_ADMIN_GROUP`

---

## สารบัญ

1. [ภาพรวม Admin Panel](#1-ภาพรวม-admin-panel)
2. [การเข้าสู่ระบบ Admin](#2-การเข้าสู่ระบบ-admin)
3. [Dashboard](#3-dashboard)
4. [จัดการ I-FAQ — Level 1 Categories](#4-จัดการ-i-faq--level-1-categories)
5. [จัดการ I-FAQ — Level 2 Categories](#5-จัดการ-i-faq--level-2-categories)
6. [จัดการ I-FAQ — Knowledge Items (บทความ)](#6-จัดการ-i-faq--knowledge-items-บทความ)
7. [จัดการ File Portal — โฟลเดอร์](#7-จัดการ-file-portal--โฟลเดอร์)
8. [จัดการ File Portal — สิทธิ์ (Permissions)](#8-จัดการ-file-portal--สิทธิ์-permissions)
9. [จัดการ File Portal — Sync ไฟล์จาก Shared Drive](#9-จัดการ-file-portal--sync-ไฟล์จาก-shared-drive)
10. [นโยบายและข้อควรระวัง](#10-นโยบายและข้อควรระวัง)
11. [คำถามที่พบบ่อย (Admin)](#11-คำถามที่พบบ่อย-admin)

---

## 1. ภาพรวม Admin Panel

Admin Panel แยกออกจากหน้า User โดยสิ้นเชิง — เข้าถึงได้ที่ `/administrator`

### สิ่งที่ Admin จัดการได้

| ส่วน | หน้าที่ | URL |
|------|---------|-----|
| **Dashboard** | ดูสรุปภาพรวมระบบ | `/administrator` |
| **Level 1** | จัดการหมวดหมู่หลัก | `/administrator/level1` |
| **Level 2** | จัดการหมวดหมู่ย่อย | `/administrator/level2` |
| **Knowledge Items** | จัดการบทความ/เอกสาร | `/administrator/knowledge` |
| **Folders** | จัดการโฟลเดอร์ File Portal | `/administrator/portal/folders` |
| **Permissions** | กำหนดสิทธิ์ AD Group ต่อโฟลเดอร์ | `/administrator/portal/permissions/:id` |
| **Sync** | Sync ไฟล์จาก Shared Drive | `/administrator/portal/sync` |

---

## 2. การเข้าสู่ระบบ Admin

### ขั้นตอน

1. ไปที่ `/admin-login` (หน้า Login พิเศษสำหรับ Admin)
2. กรอก **Username** และ **Password** (บัญชี AD เดียวกับ Windows)
3. กด **Sign In**

> ⚠️ **ต้องเป็นสมาชิกกลุ่ม AD `ICT`** (หรือกลุ่มที่กำหนดใน `.env → LDAP_ADMIN_GROUP`) จึงจะเข้าได้  
> ถ้าใช้บัญชีทั่วไปจะได้รับ Error "Access Denied"

---

## 3. Dashboard

หน้าแรกของ Admin Panel แสดง **สรุปสถิติระบบ** แบบ Real-time:

| Card | ความหมาย | กดแล้วไปที่ |
|------|----------|------------|
| **Level 1 Categories** | จำนวนหมวดหมู่หลักทั้งหมด | `/administrator/level1` |
| **Level 2 Categories** | จำนวนหมวดหมู่ย่อยทั้งหมด | `/administrator/level2` |
| **Knowledge Items** | จำนวนบทความทั้งหมด | `/administrator/knowledge` |
| **Disabled L2** | จำนวน Level 2 ที่ซ่อนอยู่ (IsEnabled=false) | `/administrator/level2` |

---

## 4. จัดการ I-FAQ — Level 1 Categories

**Route:** `/administrator/level1`

Level 1 คือ **หมวดหมู่หลัก** ที่แสดงใน Sidebar ด้านซ้ายของผู้ใช้

### 4.1 ดูรายการ Level 1

ตารางแสดง:
- **ชื่อ** หมวดหมู่ + Icon
- **จำนวน Level 2** ภายใน
- **จำนวนบทความ** ทั้งหมด
- ปุ่ม **Edit** และ **Delete**

### 4.2 สร้าง Level 1 ใหม่

1. กดปุ่ม **+ New Category** (มุมขวาบน)
2. กรอกข้อมูล:

| ฟิลด์ | คำอธิบาย | ตัวอย่าง |
|-------|-----------|---------|
| **Name** | ชื่อหมวดหมู่ (แสดงใน Sidebar) | `ระบบ SAP` |
| **Icon** | ชื่อ Icon (Heroicons) | `AcademicCapIcon` |
| **Sort Order** | ลำดับการแสดงผล (น้อย=แสดงก่อน) | `1`, `10`, `100` |

3. กด **Save**

### 4.3 แก้ไข Level 1

1. กดปุ่ม **Edit** ที่แถวที่ต้องการ
2. แก้ไขข้อมูล → กด **Save**

### 4.4 ลบ Level 1

> ⚠️ **ระวัง:** การลบ Level 1 จะลบ Level 2 และบทความทั้งหมดที่อยู่ภายในด้วย (Cascade Delete)

1. กดปุ่ม **Delete** ที่แถวที่ต้องการ
2. ยืนยันใน Dialog ที่ปรากฏ

---

## 5. จัดการ I-FAQ — Level 2 Categories

**Route:** `/administrator/level2`

Level 2 คือ **หมวดหมู่ย่อย** อยู่ภายใน Level 1

### 5.1 สร้าง Level 2 ใหม่

1. กดปุ่ม **+ New Category**
2. กรอกข้อมูล:

| ฟิลด์ | คำอธิบาย |
|-------|-----------|
| **Level 1 Parent** | เลือก Level 1 ที่เป็นเจ้าของ |
| **Name** | ชื่อหมวดหมู่ย่อย |
| **Icon** | ชื่อ Icon (Heroicons) |
| **Sort Order** | ลำดับการแสดงผล |
| **IsEnabled** | เปิด/ปิดการแสดง (ปิด = ซ่อนจากผู้ใช้ แต่ยังมีอยู่ในระบบ) |

3. กด **Save**

### 5.2 ซ่อน/แสดง Level 2 (Toggle IsEnabled)

- สถานะ **Enabled** → ผู้ใช้เห็นใน Sidebar
- สถานะ **Disabled** → ซ่อนจากผู้ใช้ (บทความข้างใน จะย้ายไปแสดงตรงๆ ใต้ Level 1 แทน)

---

## 6. จัดการ I-FAQ — Knowledge Items (บทความ)

**Route:** `/administrator/knowledge`

### 6.1 ดูรายการบทความ

- กรอง **Level 1** และ **Display Mode** ได้ด้วย Dropdown ด้านบน
- ตารางแสดง: ชื่อ, หมวดหมู่, รูปแบบ, สถานะ Highlight

### 6.2 สร้างบทความใหม่

1. กดปุ่ม **+ New**
2. กรอกข้อมูล:

| ฟิลด์ | คำอธิบาย | หมายเหตุ |
|-------|-----------|---------|
| **Level 1** | หมวดหมู่หลัก | บังคับ |
| **Level 2** | หมวดหมู่ย่อย | เว้นว่างได้ (บทความจะแสดงตรงๆ ใต้ Level 1) |
| **Title** | ชื่อบทความ | บังคับ |
| **Display Mode** | รูปแบบแสดงผล | ดูตารางด้านล่าง |
| **Sort Order** | ลำดับ | 0 = ปกติ |
| **Highlight** | ⭐ แสดงใน Featured | ติ๊กเพื่อ Highlight |

#### Display Mode — ตัวเลือก

| Mode | คำอธิบาย | ต้องกรอก |
|------|-----------|---------|
| `Page` | เนื้อหา HTML ในหน้าเว็บ | Content HTML |
| `PDF` | แสดงไฟล์ PDF | PDF URL หรือ Upload ไฟล์ |
| `Video` | แสดงวิดีโอ | Video URL (YouTube / MP4) |
| `Mixed` | ผสม HTML + PDF + วิดีโอ | Content HTML + PDF/Video URL |

#### การ Upload PDF

- เลือก Mode `PDF` หรือ `Mixed`
- กด **Browse** เพื่อเลือกไฟล์ `.pdf`
- ระบบรับได้สูงสุด **50 MB** ต่อไฟล์ (กำหนดใน `upload.js`)
- ไฟล์จะถูกเก็บใน `mnt/user-data/outputs/knowledge-system/`

#### Content HTML Editor

- รองรับ **Rich Text Editor** (WYSIWYG)
- รองรับ **HTML ดิบ** (กด Source หรือ Code mode)
- รองรับภาษาไทย ตาราง รูปภาพ

3. กด **Save**

### 6.3 แก้ไขบทความ

1. กดปุ่ม **Edit** ที่แถวที่ต้องการ
2. แก้ไขข้อมูล → กด **Save**

### 6.4 ลบบทความ

1. กดปุ่ม **Delete**
2. ยืนยันใน Dialog

> ลบเฉพาะบทความนั้น — ไม่กระทบหมวดหมู่

---

## 7. จัดการ File Portal — โฟลเดอร์

**Route:** `/administrator/portal/folders`

### ภาพรวม

ระบบ File Portal ดึงโฟลเดอร์และไฟล์มาจาก **Shared Drive** (`O:\General` หรือตามที่กำหนดใน `.env → PORTAL_DRIVE_ROOT`) และเก็บข้อมูลไว้ในฐานข้อมูล `dbo.Folders` / `dbo.FileMetadata`

### 7.1 ดูรายการโฟลเดอร์

ตารางแสดง:
- **ชื่อโฟลเดอร์** + Path เต็ม
- **สถานะ** (Active / Inactive)
- ปุ่ม **Edit**, **Delete**, **จัดการสิทธิ์**

### 7.2 สร้างโฟลเดอร์ด้วยมือ (Manual)

> 💡 **แนะนำ:** ใช้ Sync แทน (ดู [หัวข้อ 9](#9-จัดการ-file-portal--sync-ไฟล์จาก-shared-drive)) — โฟลเดอร์จะถูกสร้างอัตโนมัติ

1. กดปุ่ม **+ New Folder**
2. กรอก: ชื่อ, Path เต็ม, Parent Folder, Sort Order, Icon
3. กด **Save**

### 7.3 แก้ไขโฟลเดอร์

1. กดปุ่ม **Edit**
2. แก้ไข: ชื่อ, Icon, Sort Order, สถานะ (IsActive)
3. กด **Save**

> ⚠️ **อย่าแก้ไข FullPath** ด้วยมือ — ใช้ Sync เพื่ออัปเดต Path ให้ตรงกับ Disk

### 7.4 เปิด/ปิดโฟลเดอร์ (Toggle IsActive)

- **IsActive = ON** → แสดงให้ผู้ใช้เห็น (ถ้ามีสิทธิ์)
- **IsActive = OFF** → ซ่อนโฟลเดอร์ (ไม่ลบข้อมูลหรือสิทธิ์)

### 7.5 ลบโฟลเดอร์

> ⚠️ **ระวัง — Cascade Delete:** การลบโฟลเดอร์จะ **ลบถาวร** รวมถึง:
> - โฟลเดอร์ลูกทั้งหมด
> - FileMetadata ทั้งหมดภายใน  
> - **FolderPermissions ทั้งหมด** (สิทธิ์จะหายทั้งหมด)

1. กดปุ่ม **Delete**
2. ยืนยันใน Dialog

---

## 8. จัดการ File Portal — สิทธิ์ (Permissions)

**Route:** `/administrator/portal/permissions/:folderId`

### 8.1 เปิดหน้า Permissions

จากหน้า Folders → กดปุ่ม **🔐 Permissions** ที่แถวโฟลเดอร์ที่ต้องการ

### 8.2 ภาพรวม Permission Model

```
AD Group  ──►  FolderPermissions  ──►  Folder
                  (CanView=true)
```

- สิทธิ์กำหนดเป็น **ระดับโฟลเดอร์**
- ผู้ใช้จะเห็นโฟลเดอร์ก็ต่อเมื่อ **AD Group ของตนมีสิทธิ์ CanView**
- สิทธิ์ **ไม่ถ่ายทอดลงโฟลเดอร์ลูก** — ต้องกำหนดแยกแต่ละโฟลเดอร์

### 8.3 เพิ่มสิทธิ์ AD Group

1. กรอก **AD Group Name** (ชื่อกลุ่มใน Active Directory ตรงๆ เช่น `ICT`, `HR`, `Finance`)
2. กด **Add**

> ✅ สิทธิ์จะมีผลทันที ไม่ต้อง Restart ระบบ (Cache จะ Expire ภายใน 5 นาที)

### 8.4 ลบสิทธิ์ AD Group

1. กดปุ่ม **ลบ (🗑️)** ที่แถว AD Group ที่ต้องการ
2. ยืนยันใน Dialog

### 8.5 ข้อมูลสิทธิ์ระหว่าง Sync

> ✅ **ปลอดภัย:** ระบบ Sync ใช้ **Soft Delete** (ตั้ง `IsActive=0`) ไม่ใช่ Hard Delete — ดังนั้น **สิทธิ์ที่กำหนดไว้จะไม่หายเมื่อ Sync**  
> ถ้าโฟลเดอร์กลับมาอีกครั้ง (พบใน Disk) ระบบจะ Re-activate โฟลเดอร์นั้นพร้อมสิทธิ์เดิมโดยอัตโนมัติ

---

## 9. จัดการ File Portal — Sync ไฟล์จาก Shared Drive

**Route:** `/administrator/portal/sync`

### 9.1 การทำงานของ Sync

```
Scan Disk (O:\General)
        │
        ▼
    เปรียบเทียบกับ dbo.Folders ในฐานข้อมูล
        │
  ┌─────┴─────┐
  │           │
โฟลเดอร์ใหม่  โฟลเดอร์หาย
(INSERT)    (Soft Delete IsActive=0)
        │
        ▼
  อัปเดต dbo.FileMetadata
        │
        ▼
  ล้าง Cache (Permissions / Tree)
```

### 9.2 Auto-Sync

ระบบ Sync อัตโนมัติทุก **5 นาที** (กำหนดใน `.env → SYNC_INTERVAL_MINUTES=5`)  
ไม่ต้อง Trigger เองถ้าไม่จำเป็น

### 9.3 Manual Sync (ทำเองทันที)

1. ไปที่ `/administrator/portal/sync`
2. **Root Path** — เว้นว่างไว้ (ระบบใช้ค่า `PORTAL_DRIVE_ROOT` จาก `.env` อัตโนมัติ)  
   หรือพิมพ์ Path เพื่อ Sync เฉพาะ Sub-path
3. กดปุ่ม **▶ Sync Now**
4. รอจนเสร็จ → ดูผลสรุป

### 9.4 ผลสรุปหลัง Sync

| ตัวเลข | ความหมาย |
|--------|----------|
| **Inserted** | โฟลเดอร์ใหม่ที่เพิ่มเข้า DB |
| **Updated** | โฟลเดอร์ที่มีอยู่แล้ว (อัปเดตชื่อ/Path) |
| **Deleted** | โฟลเดอร์ที่ Soft Delete (ไม่พบใน Disk) |
| **Files** | ไฟล์ทั้งหมดที่ Scan พบ |

### 9.5 ประวัติ Sync Log

ด้านล่างปุ่ม Sync จะแสดง **Sync Log ล่าสุด 30 รายการ** — ดูวันเวลาและผลการ Sync ย้อนหลังได้

### 9.6 กรณีที่ควร Manual Sync

| สถานการณ์ | ต้อง Sync? |
|-----------|-----------|
| เพิ่ม/ลบไฟล์ใน Shared Drive แล้วอยากให้ผู้ใช้เห็นทันที | ✅ Sync Now |
| เปลี่ยนชื่อโฟลเดอร์ใน Shared Drive | ✅ Sync Now |
| ต้องการตรวจสอบว่าระบบอ่าน Drive ได้ปกติ | ✅ Sync Now |
| การเปลี่ยนแปลงทั่วไป (รอได้ 5 นาที) | ❌ รอ Auto-Sync |

---

## 10. นโยบายและข้อควรระวัง

### 10.1 การลบข้อมูล

| การกระทำ | ผลที่ตามมา |
|---------|-----------|
| ลบ Level 1 | ลบ Level 2 + บทความทั้งหมดภายใน (ถาวร) |
| ลบ Level 2 | ลบบทความทั้งหมดภายใน (ถาวร) |
| ลบบทความ | ลบเฉพาะบทความ (ถาวร) |
| ลบโฟลเดอร์ (Admin) | ลบโฟลเดอร์ลูก + FileMetadata + Permissions (ถาวร) |
| Sync พบโฟลเดอร์หายจาก Disk | Soft Delete เท่านั้น — ข้อมูล/สิทธิ์ยังอยู่ |

### 10.2 Cache และ Delay

- หลังเพิ่ม/ลบ Permissions ผลจะใช้เวลา **สูงสุด 5 นาที** กว่าผู้ใช้จะเห็น
- หลัง Sync ผลจะเห็นได้ **ทันที** (Cache ถูกล้างอัตโนมัติ)
- Authentication Cache มีอายุ **5 นาที** — ถ้าเปลี่ยนรหัสผ่าน AD ให้รอ 5 นาทีก่อน Login ใหม่

### 10.3 สิทธิ์การเข้าถึง

- ผู้ใช้จะเห็นเฉพาะโฟลเดอร์ที่ **AD Group ของตน** มีสิทธิ์
- ถ้าไม่มีสิทธิ์แม้แต่โฟลเดอร์เดียว ส่วน File Portal จะ **ไม่แสดงใน Sidebar** เลย
- Admin สามารถดูได้ทุกโฟลเดอร์ผ่านหน้า Admin

### 10.4 ไฟล์ที่แสดงใน File Portal

ระบบแสดงเฉพาะ:
- ไฟล์ **PDF** (`.pdf`)
- ไฟล์ **วิดีโอ** (`.mp4`, `.webm`, `.ogg`, `.mov`, `.avi`)

ไฟล์ประเภทอื่น (.xlsx, .docx ฯลฯ) ถูก **ซ่อนโดยอัตโนมัติ** จากผู้ใช้

---

## 11. คำถามที่พบบ่อย (Admin)

**Q: ผู้ใช้ร้องเรียนว่าเห็น Permission Denied ทั้งที่เพิ่งเพิ่ม AD Group ไปแล้ว?**  
A: Cache มีอายุ 5 นาที รอสักครู่หรือ Restart Backend เพื่อล้าง Cache ทันที

**Q: Sync แล้วยังไม่เห็นไฟล์ใหม่?**  
A: ตรวจสอบว่า Service Account ที่รัน Backend มีสิทธิ์อ่าน Shared Drive หรือไม่ ดู Sync Log เพื่อหา Error

**Q: สิทธิ์หายหลังจาก Sync?**  
A: ระบบใช้ Soft Delete แล้ว — สิทธิ์จะไม่หายจาก Sync ปกติ ถ้าสิทธิ์หายให้ตรวจสอบว่ามีใคร Hard Delete โฟลเดอร์จากหน้า Admin หรือไม่

**Q: อยากซ่อนโฟลเดอร์ชั่วคราวโดยไม่ลบสิทธิ์?**  
A: ใช้ Edit Folder แล้ว Toggle **IsActive = OFF** — สิทธิ์ยังอยู่ครบ เปิดกลับมาได้ทุกเมื่อ

**Q: อยากให้ผู้ใช้ทุกคนเห็นโฟลเดอร์นั้น?**  
A: เพิ่ม AD Group ที่ทุกคนเป็นสมาชิก เช่น `Domain Users` หรือ `Everyone` (ตรวจสอบชื่อกลุ่มจาก AD ก่อน)

**Q: อยาก Sync เฉพาะบาง Sub-folder?**  
A: ในหน้า Sync ให้พิมพ์ Path ที่ต้องการใน Root Path เช่น `O:\General\Finance`

**Q: เพิ่มบทความแล้วผู้ใช้ยังไม่เห็น?**  
A: กดรีเฟรชหน้าในฝั่งผู้ใช้ หรือล้าง Browser Cache — Knowledge จะแสดงทันที (ไม่มี Cache ด้าน I-FAQ)

---

## ประวัติการอัปเดตเอกสาร

| วันที่ | เวอร์ชัน | รายการเปลี่ยนแปลง |
|--------|---------|-------------------|
| 19 พ.ค. 2568 | 1.0 | สร้างเอกสารครั้งแรก |

---

*สอบถามข้อมูลเพิ่มเติม: ทีม ICT ภายใน*
