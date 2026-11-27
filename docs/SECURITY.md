# Security Review — TIF Stock

เอกสารสรุปมาตรการความปลอดภัยที่บังคับใช้ใน MVP และจุดที่ควรพัฒนาต่อ
อัปเดตล่าสุด: Phase 5

---

## 1. ขอบเขตและ Threat Model

ระบบเป็น internal web app สำหรับพนักงานองค์กร ไม่มี public registration
สินทรัพย์ที่ต้องปกป้อง:

- ข้อมูลผู้ใช้และรหัสผ่าน (password hash)
- Session token
- ความถูกต้องของยอดสต๊อกและประวัติการเคลื่อนไหว
- ข้อมูลการเบิก (ชื่อผู้เบิก/แผนก)

ภัยคุกคามหลัก: การยึดบัญชี, การยกระดับสิทธิ์, การแก้ยอดสต๊อกโดยไม่มีประวัติ,
การเบิกเกินยอด, การกดซ้ำ, การ inject ข้อมูลผ่านฟอร์ม/CSV และการเข้าถึงไฟล์ export

---

## 2. Authentication และ Session

| มาตรการ | รายละเอียด |
|---|---|
| Password hashing | Argon2id (memory 19 MiB, timeCost 2, parallelism 1) |
| Password policy | ≥ 10 ตัวอักษร, ต้องมีตัวอักษรและตัวเลข |
| Session token | สุ่ม 32 bytes (base64url), เก็บเฉพาะ SHA-256 hash ใน `sessions` |
| Cookie | `HttpOnly`, `SameSite=Lax`, `Secure` ใน production, อายุ 8 ชั่วโมง |
| Rotate | ออก token ใหม่ทุกครั้งที่ login |
| Revoke | logout, ปิดใช้งานผู้ใช้, รีเซ็ตรหัสผ่าน (ทุกอุปกรณ์) |
| Enumeration | ข้อความ login กลาง ๆ + ตรวจรหัสผ่านกับ dummy hash แม้ไม่พบผู้ใช้ |
| Brute force | ผิด 5 ครั้ง/อีเมล หรือ 20 ครั้ง/IP ภายใน 15 นาที (นับจาก `login_attempts`) |
| Privacy | เก็บเฉพาะ HMAC-SHA256 ของอีเมล (pepper = `AUTH_SECRET`) |

ข้อจำกัดที่ทราบ: ไม่มี MFA, ไม่มี self-service password change (Admin เป็นผู้รีเซ็ต)

---

## 3. Authorization Matrix

ตรวจสอบฝั่ง server ทุก action ผ่าน `authorizeActionUser()` / `authorizeActionAdmin()`
และการซ่อนเมนู/ปุ่มเป็นเพียง UX ไม่ใช่กลไกป้องกัน

| ความสามารถ | Staff | Admin |
|---|:---:|:---:|
| ดู Dashboard / สินค้า / ประวัติ | ✓ | ✓ |
| รับเข้า / เบิกออก | ✓ | ✓ |
| ปรับยอดหลังตรวจนับ | ✗ | ✓ |
| เพิ่ม/แก้ไข/ปิดใช้งานสินค้า | ✗ | ✓ |
| จัดการหมวดหมู่ | ✗ | ✓ |
| จัดการผู้ใช้ | ✗ | ✓ |
| Export CSV | ✗ | ✓ |

กฎเพิ่มเติม:

- ห้ามปิดใช้งาน/ลดสิทธิ์ Admin คนสุดท้าย
- ห้ามปิดใช้งานบัญชีตัวเอง
- Staff เรียก Server Action ของ Admin ตรง ๆ จะได้ `FORBIDDEN`

---

## 4. Input Validation และ Injection

- ทุก input ผ่าน Zod ก่อนแตะฐานข้อมูล (Server Action และ Route Handler)
- Drizzle ORM ใช้ parameterized query ทุกจุด; ใช้ `sql` template เฉพาะ column/ค่าที่ผูก parameter
- ค้นหา ILIKE escape `%`, `_`, `\` เพื่อไม่ให้ wildcard หลุด pattern
- จำกัดความยาวข้อความทุกช่อง และจำกัดจำนวน/ช่วงค่าตัวเลข
- `lib/utils.ts` มี `safeInternalPath()` กัน open redirect (`//evil`, `https://...`, `/\...`)
- ไม่มี `dangerouslySetInnerHTML` ในโปรเจกต์
- รูปสินค้า: ตรวจชนิดไฟล์จาก **magic bytes** (ไม่เชื่อ Content-Type ที่ client ส่ง),
  จำกัด 2 MB, เก็บใน bucket private และเสิร์ฟผ่าน `/api/products/[id]/image`
  ที่ตรวจ session ทุกครั้ง พร้อม `X-Content-Type-Options: nosniff` และ CSP `img-src 'self'`

---

## 5. Data Integrity (สต๊อก)

- `current_stock` ถูกแก้เฉพาะใน `server/lib/stock-service.ts`
- ใช้ `UPDATE ... WHERE current_stock + delta >= 0 RETURNING` ภายใน transaction เดียวกับการ INSERT movement
- ปรับยอดใช้ `SELECT ... FOR UPDATE` ก่อนคำนวณผลต่าง
- Idempotency ด้วย `stock_movements.request_id` (UNIQUE) + ตรวจ replay ทั้งกรณี insert ชน unique และกรณีที่คำขอที่สองถูกบล็อกเพราะยอดเปลี่ยน
- CHECK constraints ระดับ DB: ยอดไม่ติดลบ, before/after สอดคล้อง, OUT ต้องมีชื่อผู้เบิก, ADJUSTMENT ต้องมีเหตุผล, จำนวนต้องไม่เป็นศูนย์
- FK เป็น `RESTRICT` — ประวัติไม่ถูกลบตามสินค้า/ผู้ใช้ และไม่มี UI สำหรับแก้/ลบประวัติ

---

## 6. Web Security Headers

ตั้งใน `next.config.ts` (CSP/HSTS เฉพาะ production):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` และ `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` (production)
- `Content-Security-Policy` (production) — อนุญาต `'self'` + inline script/style ตามความจำเป็นของ Next
- `poweredByHeader: false`
- `app/robots.ts` ปิด indexing ทั้งระบบ

> CSP ปัจจุบันยังใช้ `'unsafe-inline'` สำหรับ script/style — แนวทางยกระดับคือใช้ nonce
> ผ่าน middleware และย้าย inline style ที่หลีกเลี่ยงได้ออก

---

## 7. CSRF / Clickjacking / XSS

- Server Actions มี built-in Origin/Host verification ของ Next.js
- Cookie เป็น `SameSite=Lax` และไม่ใช้ GET สำหรับ mutation
- `frame-ancestors 'none'` + `X-Frame-Options` กัน clickjacking
- React escape ข้อความอัตโนมัติ; ไม่มี raw HTML injection

---

## 8. CSV / Excel Export

- จำกัดสิทธิ์ Admin (ตรวจใน Route Handler) ทั้ง CSV และ `.xlsx`
- ใช้ UTF-8 BOM, CRLF, quote ตาม RFC 4180 (CSV)
- ป้องกัน formula injection ใน CSV: ข้อความที่ขึ้นต้นด้วย `=`, `+`, `-`, `@`, tab, CR จะถูกเติม `'`
  (ตัวเลขจริงไม่ถูกเติม เพื่อให้ Excel คำนวณได้)
- XLSX เขียนค่าข้อความเป็น string (ไม่ใช่ formula) และค่าจำนวนเป็น number
- จำกัด 50,000 แถวต่อครั้ง; ไม่มีข้อมูล credential ในไฟล์
- ตอบ `Cache-Control: no-store`

---

## 9. Secrets และ Environment

- Secrets ทั้งหมดอยู่ใน environment variables (`.env.local` ถูก gitignore)
- `AUTH_SECRET` บังคับใน production (ระบบ throw หากไม่มี/สั้นกว่า 16 ตัวอักษร)
- ตัวอย่างค่าอยู่ใน `.env.example` โดยไม่มีความลับจริง
- `bun run check:env` ตรวจความพร้อมก่อน deploy
- Seed รหัสผ่านที่สุ่มจะแสดงเพียงครั้งเดียวทาง console

---

## 10. Logging และ Privacy

- ไม่ log รหัสผ่าน/token/connection string
- ข้อความ error ฝั่งผู้ใช้เป็นข้อความกลาง ๆ; error digest ใช้ติดตาม log ฝั่ง server
- `login_attempts` เก็บเฉพาะ HMAC ของอีเมล + IP
- Session table เก็บ IP/User-Agent เพื่อการตรวจสอบ (ลบเมื่อ logout/หมดอายุ/ถูก revoke)

---

## 11. Security Review Checklist (Phase 5)

| รายการ | สถานะ |
|---|---|
| ทุก Server Action ตรวจ auth/authz | ✅ |
| ไม่มี mutation ผ่าน GET | ✅ |
| Stock mutation อยู่ใน transaction + atomic guard | ✅ |
| Idempotency กัน double submit | ✅ |
| Password hashing แข็งแรง + policy | ✅ |
| Session cookie flags ถูกต้อง | ✅ |
| Brute force + enumeration protection | ✅ |
| Open redirect ถูกบล็อก | ✅ |
| CSV injection ถูก neutralize | ✅ |
| Security headers + robots | ✅ (CSP พื้นฐาน) |
| Secrets ไม่ถูก commit | ✅ |
| FK/constraints ป้องกันประวัติกำพร้า | ✅ |
| Integration tests สำหรับ concurrency/idempotency | ✅ (รันเมื่อมี `TEST_DATABASE_URL`) |
| Dependency vulnerability audit | ✅ ดำเนินการแล้ว (ดูข้อ 14) |
| Backup/PITR + restore drill | ต้องดำเนินการฝั่ง ops (ดู DEPLOYMENT.md) |

---

## 12. ความเสี่ยงคงเหลือและข้อเสนอแนะ

1. **ไม่มี MFA** — พิจารณาเพิ่ม TOTP สำหรับ Admin
2. **ไม่มี self-service password reset** — ลด attack surface แต่เพิ่มภาระ Admin
3. **CSP ยังมี `unsafe-inline`** — ยกระดับเป็น nonce-based CSP
4. **Rate limit ใช้ตาราง DB** — ทำงานได้หลาย instance แต่เพิ่ม write; พิจารณา Redis หาก scale มากขึ้น
5. **ไม่มี audit log ของการจัดการผู้ใช้** — stock movement ครอบคลุมเฉพาะสต๊อก; ควรเพิ่ม `user_audit_log` หากต้องการ compliance
6. **Dependency hygiene** — ตั้งเตือนอัปเดต dependency และรัน `bun audit` ในรอบ release
7. **E2E อัตโนมัติ** — ยังเป็น manual checklist (ดู TESTING.md); ควรเพิ่ม Playwright เมื่อมี environment

---

## 13. Incident Response (เบื้องต้น)

1. ระงับบัญชีที่สงสัย (ปิดใช้งาน → session ทั้งหมดถูก revoke)
2. รีเซ็ตรหัสผ่านผู้ใช้ที่เกี่ยวข้อง
3. ตรวจ `stock_movements` และ `sessions` ย้อนหลัง
4. หมุน `AUTH_SECRET` และ/หรือ Neon credential หากสงสัยว่ารั่ว
5. ตรวจ backup/PITR ก่อนตัดสินใจ restore
6. บันทึกเหตุการณ์และปรับมาตรการป้องกัน

---

## 14. Dependency Audit (Phase 5)

รัน `bun audit` และแก้ช่องโหว่ที่กระทบ runtime แล้ว:

| Package | ก่อน | หลัง | หมายเหตุ |
|---|---|---|---|
| `drizzle-orm` | 0.44.7 | 0.45.4 | แก้ high: SQL injection via improperly escaped identifiers |
| `zod` | 3.25.76 | 4.6.7 | แก้ high: memory exhaustion; ปรับ error params เป็น `{ error: ... }` |
| `vitest` | 2.1.9 | 5.1.0 | แก้ critical/moderate ใน test runner |

**ความเสี่ยงคงเหลือ (ยอมรับได้ / เฝ้าระวัง):**

- `postcss@8.4.31` ถูก pin โดย Next 15.5.29 — ช่องโหว่เกิดจากการประมวลผล CSS ที่ผู้โจมตีควบคุม
  ระบบนี้ประมวลผลเฉพาะ CSS ของโปรเจกต์ตอน build ไม่รับ CSS จากผู้ใช้ จึงไม่กระทบ runtime
- `esbuild@0.18.20` ผ่าน `drizzle-kit` และ `esbuild` รุ่นเก่าใน toolchain ของ Vitest — ใช้เฉพาะ dev/CI
  ไม่ได้ถูกโหลดใน production runtime

> ให้รัน `bun audit` ทุกครั้งก่อน release และอัปเดต Next.js เมื่อมี patch ที่เลื่อน postcss ขึ้น
