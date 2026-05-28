# KM Portal — Local Protocol Handler Setup

This folder contains the Windows registry handler that lets the web portal
open local programs/files (Power BI, Excel, Word, …) via custom URL scheme:

```
kmportal://open?type=powerbi&path=\\server\share\report.pbix
```

## Files

| ไฟล์ | คำอธิบาย |
|---|---|
| `kmportal-protocol.reg`   | สมัคร URL Protocol `kmportal://` ในเครื่อง user |
| `kmportal-launcher.ps1`   | สคริปต์ที่ Windows เรียก พร้อมส่ง URL เต็มเข้ามา |

---

## ขั้นตอนติดตั้ง (เครื่อง User)

1. **คัดลอกสคริปต์** ไปไว้ที่ `C:\KMPortal\` (สร้างโฟลเดอร์ถ้ายังไม่มี):

   ```powershell
   New-Item -ItemType Directory -Path C:\KMPortal -Force
   Copy-Item .\kmportal-launcher.ps1 C:\KMPortal\
   ```

2. **Import Registry**:

   ```cmd
   reg import kmportal-protocol.reg
   ```

   หรือดับเบิ้ลคลิกไฟล์ `kmportal-protocol.reg` แล้วยอมรับ UAC

3. **ทดสอบ** — ⚠️ **อย่าพิมพ์ URL ตรงๆ ใน CMD** (จะขึ้น `'kmportal:' is not recognized`)
   ต้องใช้วิธีใดวิธีหนึ่ง:

   **วิธีที่ 1 — Run dialog (Win+R)**:
   ```
   kmportal://open?type=powerbi&path=D:\Desktop\ICT_AutoReport\ICT_Report-20250201.pbix
   ```

   **วิธีที่ 2 — CMD (ใช้คำสั่ง `start`)**:
   ```cmd
   start "" "kmportal://open?type=powerbi&path=D:\Desktop\ICT_AutoReport\ICT_Report-20250201.pbix"
   ```

   **วิธีที่ 3 — PowerShell**:
   ```powershell
   Start-Process "kmportal://open?type=powerbi&path=D:\Desktop\ICT_AutoReport\ICT_Report-20250201.pbix"
   ```

   **วิธีที่ 4 — Browser**: วางใน address bar แล้วกด Enter → ตอบ "Open"

   หากตั้งค่าถูกต้อง Power BI Desktop (หรือโปรแกรมที่เกี่ยวข้อง) จะเปิดไฟล์นั้น

   **ตรวจสอบว่า registry ติดตั้งแล้ว**:
   ```powershell
   Get-Item "HKLM:\SOFTWARE\Classes\kmportal"
   ```
   ถ้าไม่เจอ → ดับเบิ้ลคลิก `kmportal-protocol.reg` แล้วยอมรับ UAC

---

## การปรับเปลี่ยน Path สคริปต์

หากวาง `kmportal-launcher.ps1` ไว้ที่อื่น แก้ไฟล์ `kmportal-protocol.reg`
บรรทัดที่มี `C:\\KMPortal\\kmportal-launcher.ps1` ให้ตรงกับที่ตั้งใหม่
(ใส่ `\\` แทน `\` ในไฟล์ .reg)

---

## ปัญหาที่พบบ่อย

- **คลิกแล้วไม่มีอะไรเกิดขึ้น** → เช็ค `%LOCALAPPDATA%\KMPortal\launcher.log`
- **PowerShell บล็อกสคริปต์** → ใน `.reg` ใช้ `-ExecutionPolicy Bypass` อยู่แล้ว
  หากยังโดนบล็อก ให้ admin ตั้ง `Set-ExecutionPolicy -Scope LocalMachine RemoteSigned`
- **Path มีช่องว่าง / Unicode** → URL encode ฝั่งเว็บอยู่แล้ว (sanitize ด้วย `encodeURIComponent`)

---

## Security note

สคริปต์ปฏิเสธ path ที่ไม่ขึ้นต้นด้วย `\\` (UNC), drive letter (`C:\`), หรือ `http(s)://`
เพื่อกัน command injection จาก URL ที่ผู้ใช้กด
