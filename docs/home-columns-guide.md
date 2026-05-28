# คู่มือการใช้งาน Home Columns (3-คอลัมน์หน้าแรก)

หน้านี้คือเครื่องมือที่ admin ใช้ตั้งค่ากลุ่ม 3 คอลัมน์ที่จะแสดงด้านบนของหน้าแรกฝั่ง user
รองรับการเปิดโปรแกรมในเครื่อง (Power BI / Excel / Word / ไฟล์อื่นๆ) ผ่าน custom protocol `kmportal://`
และเชื่อมไปยังโฟลเดอร์ใน Portal, Knowledge Items, หรือ URL ภายนอก

เข้าใช้งานที่: **`/administrator/home`** (สิทธิ์ `admin-dt`)

---

## 1. โครงสร้างข้อมูล (มอง 1 ครั้งเข้าใจทั้งระบบ)

```
HomeGroups (3 รายการคงที่)
├── NORMAL_WORK         ← คอลัมน์ที่ 1
├── ABNORMAL_WORK       ← คอลัมน์ที่ 2
└── ADDITIONAL_INFO     ← คอลัมน์ที่ 3
        │
        └── HomeItems (รายการในกลุ่ม - เพิ่ม/ลบได้)
                ├── linkType = program        → เปิดโปรแกรมในเครื่อง
                │       └── HomeItemFileMappings  (AD Group → File Path)
                ├── linkType = folder         → ลิงก์ไปโฟลเดอร์ใน Portal
                ├── linkType = knowledge      → ลิงก์ไป Knowledge Item
                └── linkType = external_link  → URL ภายนอก
```

---

## 2. การตั้งค่ากลุ่ม (Group)

ในหน้า **Home Columns** จะเห็น 3 แถบคอลัมน์ — **NORMAL WORK / ABNORMAL WORK / ADDITIONAL INFO**

คลิกที่แถบใดๆ เพื่อกางออก จะเจอฟอร์ม "ตั้งค่า Group":

| ฟิลด์ | คำอธิบาย | ตัวอย่าง |
|---|---|---|
| **ชื่อหัวข้อ**       | ข้อความขนาดใหญ่บนหัวคอลัมน์                              | `NORMAL WORK` |
| **คำอธิบายย่อย**     | ตัวเล็กใต้ชื่อ                                           | `ให้เปิดหน้าจอค้างไว้ดังนี้` |
| **ไอคอน**            | คลาส Font Awesome (ดูข้อ 4)                             | `fa-solid fa-clipboard-check` |
| **สีหัวข้อ (HEX)**   | สีพื้นหลังหัวคอลัมน์ — เปิด color picker หรือพิมพ์ HEX     | `#FFCC99` |
| **สถานะ**            | toggle ON/OFF — ถ้า OFF จะไม่แสดงคอลัมน์นั้นบนหน้า user  | — |

> 💡 ระบบจะเลือกสีตัวอักษรอัตโนมัติ (ขาว/ดำ) ตาม luminance ของสีพื้นหลังที่เลือก
> สีอ่อนเช่น `#FFCC99` → ตัวอักษรเข้ม / สีเข้มเช่น `#1E40AF` → ตัวอักษรขาว

กดปุ่ม **"บันทึกการตั้งค่ากลุ่ม"** เพื่อบันทึก

---

## 3. การเพิ่ม/แก้ไข "รายการ" ในกลุ่ม

ในแต่ละกลุ่มจะมีปุ่ม **"+ เพิ่มรายการ"** อยู่ด้านขวา และรายการที่มีอยู่แล้วจะแสดงเป็นการ์ดด้านล่าง — hover จะเห็นปุ่ม **แก้ไข / ลบ**

### ฟอร์มเพิ่ม/แก้ไขรายการแบ่งเป็น 4 ส่วน

#### Section 1: ข้อมูลทั่วไป
- **ชื่อรายการ\***  — ข้อความที่ user จะเห็น
- **คำอธิบายย่อย** — ข้อความขนาดเล็ก (optional)
- **ไอคอน**         — Font Awesome class + ตัวอย่างไอคอนยอดนิยม

#### Section 2: ประเภทลิงก์ (เลือก 1 จาก 4)

| ประเภท         | ใช้เมื่อ |
|---|---|
| **เปิดโปรแกรม**  | ต้องการให้คลิกแล้วเปิด `.pbix`, `.xlsx`, `.docx` หรือไฟล์อื่นในเครื่อง user |
| **โฟลเดอร์**     | ลิงก์ไปยังหน้า Portal ของโฟลเดอร์ที่เคยตั้งค่าไว้ |
| **Knowledge**    | ลิงก์ไปยังหน้าบทความ Knowledge Item |
| **URL ภายนอก**   | เปิดเว็บไซต์อื่นในแท็บใหม่ |

#### Section 3: ตั้งค่ารายละเอียด (ขึ้นกับประเภท)

##### 3.1 — เปิดโปรแกรม (program)
- **ชนิดโปรแกรม** — Power BI / Excel / Word / ไฟล์อื่นๆ
- **การจับคู่ AD Group → File Path** (ตารางหลายแถว):
  - **AD Group** — ชื่อกลุ่มใน Active Directory เช่น `dt-staff`
  - **File Path** — UNC path หรือ drive path เช่น `\\fileserver\reports\monthly.pbix`

> ⚙️ **กลไกการเลือกไฟล์**:
> เมื่อ user คลิก ระบบจะวนดูตาราง mapping จากบนลงล่าง และใช้ **แถวแรกที่ AD Group ของ user ตรง**
> ถ้าไม่มีแถวใดตรงเลย → user จะเห็นรายการนั้นเป็น **เทาขีดฆ่า** พร้อม label `no access`

> 🔒 **ความปลอดภัย**:
> launcher PowerShell จะปฏิเสธ path ที่ไม่ขึ้นต้นด้วย `\\`, `C:\`, หรือ `https?://`
> เพื่อป้องกัน command injection

##### 3.2 — โฟลเดอร์ (folder)
- **Folder ID\*** — กรอกเลข ID ของโฟลเดอร์ (ดูจากหน้า "จัดการโฟลเดอร์")
- ระบบจะตรวจสิทธิ์อัตโนมัติด้วย `canAccessFolder()` — ถ้า user ไม่มีสิทธิ์ จะไม่เห็นรายการนี้

##### 3.3 — Knowledge
- **Knowledge ID\*** — เลข ID ของ Knowledge Item (ดูจากหน้า "Knowledge Items")

##### 3.4 — URL ภายนอก
- **URL\*** — เปิดในแท็บใหม่ ไม่ผ่านระบบสิทธิ์

#### Section 4: ตัวเลือกอื่น
- **ลำดับการแสดง** (sortOrder) — เลขน้อยมาก่อน (0, 1, 2, ...)
- **สถานะ** (toggle) — เปิด/ปิดเฉพาะรายการนี้

กดปุ่ม **"เพิ่มรายการ"** หรือ **"บันทึกการแก้ไข"** ที่มุมขวาล่าง

---

## 4. ไอคอน Font Awesome

ระบบใช้ Font Awesome 6 (Free) — ใส่เป็น **class string** ที่มี 2 ส่วน:

```
[ style ] [ icon-name ]
   ↓           ↓
fa-solid   fa-folder
```

### Style ที่รองรับ
| Style    | คำอธิบาย              |
|---|---|
| `fa-solid`  | แบบทึบ (default — ใช้บ่อยที่สุด) |
| `fa-regular`| แบบโครง                              |
| `fa-brands` | logo เช่น Microsoft, Google           |

### ตัวอย่างที่ใช้บ่อย
| ใช้กับ          | Class                                     |
|---|---|
| โฟลเดอร์ทั่วไป  | `fa-solid fa-folder`                      |
| โฟลเดอร์เปิด    | `fa-solid fa-folder-open`                 |
| รายงาน Power BI | `fa-solid fa-chart-pie`                   |
| Excel            | `fa-solid fa-file-excel`                  |
| Word             | `fa-solid fa-file-word`                   |
| ฐานข้อมูล       | `fa-solid fa-database`                    |
| เซิร์ฟเวอร์      | `fa-solid fa-server`                      |
| คำเตือน          | `fa-solid fa-triangle-exclamation`        |
| ข้อมูล           | `fa-solid fa-circle-info`                 |
| หนังสือ          | `fa-solid fa-book`                        |
| ลิงก์ภายนอก     | `fa-solid fa-arrow-up-right-from-square`  |

> ค้นหาไอคอนเพิ่มเติม: <https://fontawesome.com/search?o=r&m=free>
> 1. ค้นหา keyword 2. ดูชื่อใต้ไอคอน 3. ใส่เป็น `fa-solid fa-<ชื่อ>`

---

## 5. การเลือกสี

- **Color Picker** — คลิกช่องสีเพื่อเปิด Windows color dialog
- **HEX text** — พิมพ์ตรงๆ ในรูป `#RRGGBB` หรือ `#RGB` (เช่น `#FFCC99` หรือ `#FC9`)
- **Preset 15 สี** — คลิกเลือกได้เลย แบ่งเป็นโทน blue / red / green / purple / pastel

ตัวอย่างสีแนะนำ:
| ใช้กับ              | HEX        |
|---|---|
| งาน Normal           | `#3B82F6` (น้ำเงิน) |
| งาน Abnormal         | `#EF4444` (แดง)     |
| ข้อมูลเสริม          | `#10B981` (เขียว)   |
| สีพาสเทลโทนอ่อน     | `#FFCC99`           |

---

## 6. กลไกการแสดงผลฝั่ง User

เมื่อ user เปิดหน้าแรก ระบบจะดึง `/api/home/data` (auth) และ:

1. **Group disabled** → ไม่แสดงคอลัมน์
2. **Item disabled** → ไม่แสดงรายการ
3. สำหรับแต่ละรายการ:
   - **program** — หา AD Group ของ user ที่ match mapping → ใช้ FilePath แรกที่ตรง
     - ถ้าไม่ตรงเลย → แสดงเป็นเทาขีดฆ่า (no access)
   - **folder** — เรียก `canAccessFolder(folderId, userGroups)` (ใช้สิทธิ์เดิมที่ตั้งไว้)
     - ถ้าไม่มีสิทธิ์ → ซ่อนรายการ
     - คลิก chevron `▶` เพื่อกาง subfolder ในตัว (lazy load)
   - **knowledge** — แสดงตามปกติ (สิทธิ์ตรวจที่หน้า detail)
   - **external_link** — เปิดแท็บใหม่ (ไม่ตรวจสิทธิ์)

---

## 7. การติดตั้ง custom protocol บนเครื่อง User (จำเป็นสำหรับ "เปิดโปรแกรม")

ดู [`docs/installer/README.md`](../installer/README.md) เพื่อ:
1. คัดลอก `kmportal-launcher.ps1` ไปที่ `C:\KMPortal\`
2. ดับเบิลคลิก `kmportal-protocol.reg` (ขอ UAC)
3. ทดสอบด้วย `kmportal://open?type=excel&path=C:\Users\Public\test.xlsx`

ถ้าไม่ติดตั้งฝั่ง user — รายการ "program" จะคลิกแล้ว Windows ถามว่าจะเปิดด้วยโปรแกรมอะไร

---

## 8. Workflow แนะนำ (Step-by-step สำหรับ admin)

### กรณี: เพิ่ม dashboard Power BI ใหม่

1. ไปที่ `/administrator/home`
2. คลิกที่กลุ่ม **NORMAL WORK** เพื่อกางออก
3. กดปุ่ม **"+ เพิ่มรายการ"**
4. **Section 1**: กรอกชื่อ `รายงาน Production - DT Staff` + เลือกไอคอน `fa-solid fa-chart-pie`
5. **Section 2**: คลิกการ์ด **"เปิดโปรแกรม"**
6. **Section 3**:
   - ชนิดโปรแกรม → **Power BI**
   - กด **"+ เพิ่ม"** mapping:
     - AD Group: `dt-staff` | File Path: `\\fileserver\BI\dt-staff.pbix`
     - AD Group: `dt-supervisor` | File Path: `\\fileserver\BI\dt-supervisor.pbix`
7. **Section 4**: ลำดับ = 1, toggle เปิด
8. กด **"เพิ่มรายการ"**
9. ทดสอบ: เปิดหน้าแรกฝั่ง user (ที่อยู่ใน group `dt-staff`) → คลิกรายการ → Power BI Desktop เปิดไฟล์

### กรณี: ลิงก์ไปโฟลเดอร์ที่มีสิทธิ์อยู่แล้ว

1. กลุ่ม **ADDITIONAL INFO** → **+ เพิ่มรายการ**
2. ชื่อ `เอกสารคู่มือ DT` + ไอคอน `fa-solid fa-folder`
3. ประเภท → **โฟลเดอร์**
4. Folder ID → `42` (ดูจากหน้าจัดการโฟลเดอร์)
5. บันทึก → ระบบจะเช็คสิทธิ์อัตโนมัติให้ user แต่ละคน

---

## 9. Troubleshooting

| อาการ | สาเหตุที่น่าจะเป็น | แก้ |
|---|---|---|
| คอลัมน์ไม่แสดงเลย                        | Group ปิดอยู่ทั้งหมด                     | toggle เปิดที่ฟอร์ม Group |
| รายการ program เป็นเทาขีดฆ่า              | User ไม่อยู่ใน AD Group ใดๆ ที่ตรง       | เพิ่ม mapping ให้ครอบคลุม group ของ user |
| คลิก program แล้ว Windows ถามโปรแกรม     | ยังไม่ติดตั้ง registry                   | ดู `docs/installer/README.md` |
| รายการ folder หายไป                      | User ไม่มีสิทธิ์โฟลเดอร์นั้น              | ตั้งสิทธิ์ที่หน้า "Permissions" |
| ไอคอนแสดงเป็นรูปวงกลม `?`                 | Class Font Awesome พิมพ์ผิด              | คัดลอกจากปุ่ม "ตัวอย่าง" หรือเช็คที่เว็บ FA |
| สีหัวคอลัมน์ดูแปลก                         | HEX ใส่ผิดรูปแบบ                          | ใช้ `#RRGGBB` 6 หลัก เช่น `#FFCC99` |

---

## 10. API ที่เกี่ยวข้อง (สำหรับนักพัฒนา)

```
PUBLIC (auth required)
GET    /api/home/data                 → ดึง 3 columns + items ที่ user ปัจจุบันมีสิทธิ์

ADMIN (admin-dt only)
GET    /api/admin/home/all            → tree เต็ม (ทุก group + items + mappings)
PUT    /api/admin/home/groups/:id     → แก้ไข group (title/icon/color/enabled)
POST   /api/admin/home/items          → เพิ่มรายการใหม่
PUT    /api/admin/home/items/:id      → แก้ไขรายการ (รวม mappings)
DELETE /api/admin/home/items/:id      → ลบรายการ
PUT    /api/admin/home/items/:id/mappings  → replace ทุก mapping ของ item
```

ตาราง:
- `dbo.HomeGroups` (Id, GroupKey, Title, Subtitle, Icon, **Color** NVARCHAR(20), SortOrder, IsEnabled, ...)
- `dbo.HomeItems`  (Id, GroupId, Title, Subtitle, Icon, LinkType, ProgramType, FolderId, KnowledgeId, ExternalUrl, SortOrder, IsEnabled, ...)
- `dbo.HomeItemFileMappings` (Id, ItemId, AdGroup, FilePath, SortOrder, ...)
