# คู่มือการใช้งาน Home Columns (คอลัมน์หน้าแรก)

หน้านี้คือเครื่องมือที่ admin ใช้ตั้งค่าคอลัมน์ (กลุ่ม) ที่จะแสดงด้านบนของหน้าแรกฝั่ง user
ค่าเริ่มต้นมี 3 คอลัมน์ — เพิ่ม / ลบ / สลับลำดับคอลัมน์ได้ (ดูข้อ 2.1)
รองรับการเปิดโปรแกรมในเครื่อง (Power BI / Excel / Word / ไฟล์อื่นๆ) ผ่าน custom protocol `kmportal://`
และเชื่อมไปยังโฟลเดอร์ใน Portal, Knowledge Items, หรือ URL ภายนอก

เข้าใช้งานที่: **`/administrator/home`** (สิทธิ์ `admin-dt`)

---

## 1. โครงสร้างข้อมูล (มอง 1 ครั้งเข้าใจทั้งระบบ)

```
HomeGroups (ค่าเริ่มต้น 3 รายการ — เพิ่ม/ลบ/สลับลำดับได้)
├── NORMAL_WORK         ← คอลัมน์ที่ 1
├── ABNORMAL_WORK       ← คอลัมน์ที่ 2
├── ADDITIONAL_INFO     ← คอลัมน์ที่ 3
└── ...                 ← คอลัมน์ที่ admin เพิ่มเอง (GroupKey สร้างอัตโนมัติ)
        │
        └── HomeItems (รายการในกลุ่ม - เพิ่ม/ลบได้)
                ├── linkType = program        → เปิดโปรแกรมในเครื่อง
                │       └── HomeItemFileMappings  (AD Group → File Path)
                ├── linkType = program_group  → เปิดโปรแกรมแบบกลุ่ม (ชี้โฟลเดอร์)
                │       └── HomeItemFileMappings  (AD Group → Folder Path)
                ├── linkType = folder         → ลิงก์ไปโฟลเดอร์ใน Portal
                ├── linkType = knowledge      → ลิงก์ไป Knowledge Item
                └── linkType = external_link  → URL ภายนอก
```

---

## 2. การตั้งค่ากลุ่ม (Group)

ในหน้า **Home Columns** จะเห็นแถบคอลัมน์เรียงตามลำดับที่แสดงบนหน้าแรก (ค่าเริ่มต้น **NORMAL WORK / ABNORMAL WORK / ADDITIONAL INFO**)

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

### 2.1 เพิ่ม / ลบ / สลับลำดับคอลัมน์

| ทำอะไร | วิธี |
|---|---|
| **เพิ่มคอลัมน์** | กดปุ่ม **"+ เพิ่มคอลัมน์"** มุมขวาบน → กรอกฟอร์มเดียวกับ "ตั้งค่า Group" (ชื่อหัวข้อ\* / คำอธิบายย่อย / ไอคอน / สี / สถานะ) → **"เพิ่มคอลัมน์"** คอลัมน์ใหม่จะต่อท้ายสุด และระบบสร้าง `GroupKey` ให้อัตโนมัติจากชื่อ (ตัวอักษรอังกฤษ/ตัวเลข เช่น `SAFETY_DOCS`; ชื่อภาษาไทยล้วนจะได้ `GROUP`, `GROUP_2`, ...) |
| **ลบคอลัมน์** | กดไอคอน 🗑 ท้ายแถบคอลัมน์ → ยืนยัน ระบบจะแจ้งจำนวนรายการที่จะถูกลบไปด้วย — **รายการทั้งหมดในคอลัมน์และการจับคู่ AD Group จะถูกลบถาวร** กู้คืนไม่ได้ |
| **สลับลำดับ** | กดลูกศร ↑ / ↓ ท้ายแถบคอลัมน์ บันทึกทันที (ลำดับบนหน้าแรก = ลำดับในหน้านี้) |

> การแก้ไข "ตั้งค่า Group" ไม่เปลี่ยนลำดับคอลัมน์ — ลำดับเปลี่ยนได้จากปุ่ม ↑ / ↓ เท่านั้น

**Layout บนหน้าแรกปรับตามจำนวนคอลัมน์ที่เปิดอยู่:**

| จำนวนคอลัมน์ | มือถือ | แท็บเล็ต (md) | จอกว้าง |
|---|---|---|---|
| 1 | 1 | 1 | 1 |
| 2 | 1 | 2 | 2 |
| 3 | 1 | 2 | 3 (lg) |
| 4 | 1 | 2 | 4 (xl) |
| 5 ขึ้นไป | 1 | 2 | 3 ต่อแถว (lg) แล้วขึ้นแถวใหม่ |

---

## 3. การเพิ่ม/แก้ไข "รายการ" ในกลุ่ม

ในแต่ละกลุ่มจะมีปุ่ม **"+ เพิ่มรายการ"** อยู่ด้านขวา และรายการที่มีอยู่แล้วจะแสดงเป็นการ์ดด้านล่าง — hover จะเห็นปุ่ม **แก้ไข / ลบ**

### ฟอร์มเพิ่ม/แก้ไขรายการแบ่งเป็น 4 ส่วน

#### Section 1: ข้อมูลทั่วไป
- **ชื่อรายการ\***  — ข้อความที่ user จะเห็น
- **คำอธิบายย่อย** — ข้อความขนาดเล็ก (optional)
- **ไอคอน**         — Font Awesome class + ตัวอย่างไอคอนยอดนิยม

#### Section 2: ประเภทลิงก์ (เลือก 1 จาก 5)

| ประเภท         | ใช้เมื่อ |
|---|---|
| **เปิดโปรแกรม**  | ต้องการให้คลิกแล้วเปิด `.pbix`, `.xlsx`, `.docx` หรือไฟล์อื่นในเครื่อง user |
| **เปิดโปรแกรมแบบกลุ่ม** | ชี้ path ไปยัง **โฟลเดอร์** — user คลิกแล้วเห็นรายการไฟล์ทั้งหมดข้างใน และเลือกเปิดทีละไฟล์ |
| **โฟลเดอร์**     | ลิงก์ไปยังหน้า Portal ของโฟลเดอร์ที่เคยตั้งค่าไว้ |
| **Knowledge**    | ลิงก์ไปยังหน้าบทความ Knowledge Item |
| **URL ภายนอก**   | เปิดเว็บไซต์อื่นในแท็บใหม่ |

#### Section 3: ตั้งค่ารายละเอียด (ขึ้นกับประเภท)

##### 3.1 — เปิดโปรแกรม (program)
- **ชนิดโปรแกรม** — Power BI / Excel / Word / ไฟล์อื่นๆ
- **การจับคู่ AD Group → File Path** (ตารางหลายแถว):
  - **AD Group** — ชื่อกลุ่มใน Active Directory เช่น `dt-staff`
  - **File Path** — UNC path หรือ drive path รองรับ 3 รูปแบบ:

| รูปแบบ | ตัวอย่าง | พฤติกรรม |
|---|---|---|
| ไฟล์ตรงตัว | `\\fileserver\reports\monthly.pbix` | เปิดไฟล์นั้น ถ้าไฟล์ถูกเปลี่ยนชื่อไปแล้ว จะหาไฟล์ที่ชื่อใกล้เคียงและนามสกุลเดียวกันในโฟลเดอร์เดียวกัน เลือกตัวที่แก้ไขล่าสุด |
| โฟลเดอร์ | `\\fileserver\reports\daily\` | เลือกไฟล์ที่แก้ไขล่าสุดที่นามสกุลตรงกับชนิดโปรแกรม |
| wildcard | `\\fileserver\reports\daily\L1-2-Data*.xlsm` | เลือกไฟล์ที่แก้ไขล่าสุดที่ชื่อตรงแพทเทิร์น |

> ⚙️ **resolve ตอนคลิก**: frontend เรียก `GET /api/home/items/:id/resolve` ก่อนยิง `kmportal://`
> ไม่มี popup ให้เลือก ระบบตัดสินใจให้เลย ถ้า server อ่าน share ไม่ได้ จะ fallback ไปใช้ path ดิบที่บันทึกไว้
> `matchMode` ใน response บอกว่าเลือกมาด้วยวิธีไหน: `exact` / `renamed` / `folder` / `glob` / `raw`

> ⚙️ **กลไกการเลือกไฟล์**:
> เมื่อ user คลิก ระบบจะวนดูตาราง mapping จากบนลงล่าง และใช้ **แถวแรกที่ AD Group ของ user ตรง**
> ถ้าไม่มีแถวใดตรงเลย → user จะเห็นรายการนั้นเป็น **เทาขีดฆ่า** พร้อม label `no access`

> 🔒 **ความปลอดภัย**:
> launcher PowerShell จะปฏิเสธ path ที่ไม่ขึ้นต้นด้วย `\\`, `C:\`, หรือ `https?://`
> เพื่อป้องกัน command injection

##### 3.1b — เปิดโปรแกรมแบบกลุ่ม (program_group)
- **ชนิดโปรแกรม** — Power BI / Excel / Word / ไฟล์อื่นๆ (ใช้ตอนสั่งเปิดไฟล์ผ่าน `kmportal://`)
- **การจับคู่ AD Group → Folder Path** (ตารางหลายแถว):
  - **AD Group** — ชื่อกลุ่มใน Active Directory เช่น `dt-staff`
  - **Folder Path** — UNC path ของ **โฟลเดอร์** เช่น `\\fileserver\reports\daily`

> ⚙️ **กลไกการทำงาน**:
> เมื่อ user คลิก ระบบจะเรียก `GET /api/home/items/:id/files` — server อ่านไฟล์ทั้งหมด
> ในโฟลเดอร์ที่ AD Group ของ user แมตช์ (ไม่ recursive, ข้ามไฟล์ซ่อน/ไฟล์ temp `~$`)
> แล้วแสดง popup ให้เลือก — กดไฟล์ไหนจึงค่อยเปิดผ่าน `kmportal://`
> ถ้าไม่มี AD Group แมตช์เลย → แสดงเป็น **เทาขีดฆ่า** `no access` เหมือน program

##### 3.2 — โฟลเดอร์ (folder)
- **Folder ID\*** — กรอกเลข ID ของโฟลเดอร์ (ดูจากหน้า "จัดการโฟลเดอร์")
- ระบบจะตรวจสิทธิ์อัตโนมัติด้วย `canAccessFolder()` — ถ้า user ไม่มีสิทธิ์ จะไม่เห็นรายการนี้

##### 3.3 — Knowledge
- **Knowledge ID\*** — เลข ID ของ Knowledge Item (ดูจากหน้า "Knowledge Items")

##### 3.4 — URL ภายนอก
- **URL\*** — เปิดในแท็บใหม่ ไม่ผ่านระบบสิทธิ์
- 🔒 **รับเฉพาะ `http://` หรือ `https://`** (เช่น `https://example.com`, `http://intranet/page`) — URL แบบอื่น เช่น `javascript:`, `data:`, `file:` จะถูกปฏิเสธตอนบันทึก (400)
  และหน้าแรกจะไม่แสดงรายการที่ URL ไม่ขึ้นต้นด้วย http/https (กันข้อมูลเก่าที่บันทึกไว้ก่อนมีการตรวจ)

##### 3.5 — ข้อมูลที่ต้องกรอก (บันทึกไม่ได้ถ้าไม่ครบ)

| ประเภท | ต้องมี |
|---|---|
| เปิดโปรแกรม / เปิดโปรแกรมแบบกลุ่ม | การจับคู่ AD Group → Path **อย่างน้อย 1 แถว** และทุกแถวต้องกรอกครบทั้ง 2 ช่อง (AD Group ≤ 200 ตัวอักษร, Path ≤ 1000 ตัวอักษร) |
| โฟลเดอร์ | เลือกโฟลเดอร์ |
| Knowledge | เลือก Knowledge Item |
| URL ภายนอก | URL ที่ขึ้นต้นด้วย `http://` หรือ `https://` |

ถ้าไม่ครบ ฟอร์มจะแสดงข้อความสีแดงใต้ช่องที่ผิด (ตรวจทั้งฝั่งหน้าเว็บและฝั่ง server)
ค่าที่ไม่เกี่ยวกับประเภทที่เลือก (เช่น Folder ID ของรายการประเภท URL) จะถูกล้างทิ้งตอนบันทึก

#### Section 4: ตัวเลือกอื่น
- **ลำดับการแสดง** (sortOrder) — เลขน้อยมาก่อน (0, 1, 2, ...)
- **สถานะ** (toggle) — เปิด/ปิดเฉพาะรายการนี้
- **แสดงตั้งแต่แรก** (toggle, `IsPinned`) — ON = แสดงบนหน้าแรกทันที / OFF = ซ่อนไว้จนกว่า user กด **Show More**
  - ปุ่ม Show More/Hide อยู่ใต้คอลัมน์ทั้งหมด กดครั้งเดียวกาง/ซ่อนทุกคอลัมน์พร้อมกัน สถานะถูกจำใน `sessionStorage` (`home.showAll`) จนปิดแท็บ
  - คอลัมน์ที่ไม่มีรายการ pinned เลย จะแสดงทุกรายการเสมอ
  - ต้องรัน `Back-end/SQL/migration_add_home_ispinned.sql` ก่อนใช้งาน

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
   - **program_group** — คลิกแล้วเปิด popup แสดงไฟล์ทั้งหมดในโฟลเดอร์ที่ AD Group แมตช์
     (server อ่านโฟลเดอร์สดๆ ทุกครั้งที่เปิด popup) → กดไฟล์เพื่อเปิดผ่าน `kmportal://`
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
| บันทึกรายการ URL ไม่ได้ / รายการ URL ไม่แสดงบนหน้าแรก | URL ไม่ขึ้นต้นด้วย `http://` หรือ `https://` | แก้ URL ให้ขึ้นต้นด้วย `https://` |

---

## 10. API ที่เกี่ยวข้อง (สำหรับนักพัฒนา)

```
PUBLIC (auth required)
GET    /api/home/data                 → ดึงทุก column (ที่เปิดอยู่) + items ที่ user ปัจจุบันมีสิทธิ์
GET    /api/home/items/:id/resolve    → (program) path ของไฟล์ที่มีอยู่จริงตอนนี้ + matchMode
GET    /api/home/items/:id/files      → (program_group) รายการไฟล์ในโฟลเดอร์ที่ AD Group ของ user แมตช์

ADMIN (admin-dt only)
GET    /api/admin/home/all            → tree เต็ม (ทุก group + items + mappings)
POST   /api/admin/home/groups         → เพิ่ม group { title*, subtitle?, icon?, color?, isEnabled? }
                                        → 201 { ok, id, groupKey, sortOrder }  (ต่อท้ายสุด, GroupKey สร้างให้)
PUT    /api/admin/home/groups/order   → { order: [{ id, sortOrder }] } ใน transaction เดียว → { ok, updated }
PUT    /api/admin/home/groups/:id     → แก้ไข group (title/icon/color/enabled; ไม่ส่ง sortOrder = คงลำดับเดิม)
DELETE /api/admin/home/groups/:id     → ลบ group + items + mappings ใน transaction เดียว → { ok, deletedItems }
POST   /api/admin/home/items          → เพิ่มรายการใหม่ (item + mappings ใน transaction เดียว)
PUT    /api/admin/home/items/:id      → แก้ไขรายการ (รวม mappings, transaction เดียว)
DELETE /api/admin/home/items/:id      → ลบรายการ
PUT    /api/admin/home/items/:id/mappings  → replace ทุก mapping ของ item
```

Validation error ทุก endpoint ตอบ `400 { error: "<ข้อความแรก (ภาษาไทย)>", code: "VALIDATION", errors: [{ path, msg, ... }] }`

ตาราง:
- `dbo.HomeGroups` (Id, GroupKey, Title, Subtitle, Icon, **Color** NVARCHAR(20), SortOrder, IsEnabled, ...)
- `dbo.HomeItems`  (Id, GroupId, Title, Subtitle, Icon, LinkType, ProgramType, FolderId, KnowledgeId, ExternalUrl, SortOrder, IsEnabled, IsPinned, ...)
- `dbo.HomeItemFileMappings` (Id, ItemId, AdGroup, FilePath, SortOrder, ...)
