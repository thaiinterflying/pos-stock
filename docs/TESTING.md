# Testing Guide — TIF Stock

แนวทางทดสอบระบบตั้งแต่ unit tests ไปจนถึง manual E2E และ integration tests บน Neon

---

## 1. ระดับการทดสอบ

| ระดับ | เครื่องมือ | สถานะ |
|---|---|---|
| Unit tests | Vitest | ✅ รันใน CI ทุกครั้ง |
| Integration tests (DB) | Vitest + Neon branch | ✅ พร้อมรันเมื่อมี `TEST_DATABASE_URL` |
| E2E (UI) | Manual checklist (ยังไม่ติดตั้ง Playwright) | ✅ เอกสารด้านล่าง |
| Security review | Checklist + `bun audit` | ✅ ดู `docs/SECURITY.md` |

---

## 2. คำสั่งที่ใช้

```bash
bun run typecheck        # ตรวจ TypeScript
bun run test             # unit + integration (integration skip หากไม่มี env)
bun run test:unit        # unit tests เท่านั้น
bun run test:integration # integration tests (ต้องมี TEST_DATABASE_URL)
bun run build            # production build
```

### Unit test coverage (Phase 1–5)

- Session token generation/hash (`tests/unit/session-tokens.test.ts`)
- Login/user validation + password policy (`validations.test.ts`)
- Product validation: SKU normalization, จำนวนเต็ม/ไม่ติดลบ (`product-validation.test.ts`)
- Stock validation: รับเข้า/เบิกออก/ปรับยอด, requestId UUID (`stock-validation.test.ts`)
- Stock status thresholds + parameter mapping (`stock.test.ts`)
- Bangkok date boundaries + CSV datetime (`date-range.test.ts`, `format.test.ts`)
- CSV escaping/BOM/CRLF/formula injection (`csv.test.ts`)
- XLSX workbook: หัวตาราง ข้อมูลไทย ตัวเลข และไฟล์ที่เปิดอ่านกลับได้ (`xlsx.test.ts`)
- Open redirect, initials, password generator (`utils.test.ts`)
- Request ID fallback/UUID format (`request-id.test.ts`)

---

## 3. Integration Tests (Neon branch)

### เตรียมสภาพแวดล้อม

1. สร้าง **Neon branch** แยกสำหรับทดสอบ (ห้ามใช้ production)
2. รัน migration กับ branch นั้น:
   ```bash
   DATABASE_URL_UNPOOLED="postgresql://...branch.../tifstock_test?sslmode=require" \
     bun run db:migrate
   ```
3. รัน tests:
   ```bash
   TEST_DATABASE_URL="postgresql://...branch...-pooler.../tifstock_test?sslmode=require" \
     bun run test:integration
   ```

> `TEST_DATABASE_URL` ต้องเป็น pooled endpoint เพราะแอปใช้ WebSocket driver
> ข้อมูลทดสอบจะถูกสร้างและลบใน `afterAll` โดยอัตโนมัติ

### สิ่งที่ทดสอบ

| Test | สิ่งที่ยืนยัน |
|---|---|
| เบิกพร้อมกัน 2 รายการจาก 5 ชิ้น | สำเร็จเพียงรายการเดียว, สต๊อกเหลือ 1, มี movement 1 รายการ |
| รับเข้าด้วย `request_id` เดิม | ไม่เพิ่มสต๊อกซ้ำ และมี movement 1 รายการ |
| ปรับยอด + replay | ผลต่างถูกต้อง, ไม่สร้างรายการซ้ำ, ยอดตรงระบบ = ไม่เปลี่ยน |
| Constraint ระดับ DB | ถูกบังคับโดย migration (ยอดติดลบ/ยอดไม่สอดคล้อง/OUT ไม่มีผู้เบิก) |

### การทดสอบ constraint แบบ manual (ผ่าน psql/Neon SQL Editor)

```sql
-- ต้อง error: ยอดติดลบ
UPDATE products SET current_stock = -1 WHERE sku = 'A4-001';

-- ต้อง error: OUT ต้องมีชื่อผู้เบิก
INSERT INTO stock_movements
  (product_id, type, quantity_change, quantity_before, quantity_after, performed_by, request_id)
VALUES ('<product-id>', 'OUT', -1, 1, 0, '<user-id>', gen_random_uuid());
```

---

## 4. Manual E2E Checklist

### Admin

1. Login → Dashboard แสดงสถิติและรายการที่ควรเติม
2. สร้างหมวดหมู่ → เพิ่มสินค้า (ยอดเริ่มต้น 10) → เห็น OPENING 0 → 10
3. รับเข้า 5 → คงเหลือ 15 และมีประวัติ IN
4. เบิกออก 20 → ถูกบล็อก (เกินยอด)
5. เบิกออก 3 (ระบุชื่อผู้เบิก/แผนก) → คงเหลือ 12 และมีประวัติ
6. ปรับยอดเป็น 8 พร้อมเหตุผล → movement ADJUSTMENT -4
7. แก้ไขสินค้า → ใส่จำนวนที่นับได้จริง + เหตุผล → สต๊อกอัปเดตและมี ADJUSTMENT; เว้นว่าง = ยอดไม่เปลี่ยน
8. กดยืนยันรายการเดิมซ้ำ (จำลองเน็ตช้า) → ไม่มีรายการซ้ำ
9. ประวัติ: ค้นหา SKU, กรองประเภท OUT, ช่วงวันที่วันนี้ → ผลตรง
10. Export CSV → เปิด Excel ภาษาไทยถูกต้อง, ค่าตรงกับหน้าจอ
11. Export Excel (.xlsx) → เปิดได้, หัวตาราง/ฟิลเตอร์/ตัวเลขถูกต้อง
12. ปิดใช้งานสินค้า → หายจากรายการ, ประวัติยังอยู่, เคลื่อนไหวสต๊อกไม่ได้
13. จัดการผู้ใช้: เพิ่ม Staff, รีเซ็ตรหัสผ่าน, ปิดใช้งาน → session ถูกตัด
14. พยายามปิดใช้งาน/ลดสิทธิ์ Admin คนสุดท้าย → ถูกบล็อก

### Staff

1. Login → ไม่เห็นเมนู "ตั้งค่า"
2. เข้า `/settings/users` ตรง ๆ → ถูกพาไป Dashboard พร้อมข้อความแจ้ง
3. รับเข้า/เบิกออกได้; ไม่เห็นปุ่มปรับยอด
4. เรียก Server Action ปรับยอดตรง ๆ → ถูกปฏิเสธ
5. เปิด `/api/export/stock-movements?...` → 403
6. เห็นประวัติทั้งหมดและใช้ตัวกรองได้

### Security / Non-functional

1. Login ผิด 6 ครั้ง → ถูกจำกัด 15 นาที
2. ตรวจ cookie `tif_session` → HttpOnly, SameSite=Lax, Secure (production)
3. ตรวจ DB → `sessions.token_hash` ไม่ใช่ token จริง
4. ตรวจ response headers → CSP/HSTS/X-Frame-Options (production)
5. `/robots.txt` → Disallow: /
6. มือถือ 375px → sidebar เป็น drawer, ตารางเลื่อนได้, dialog ใช้งานได้
7. เน็ตช้า/กด submit ซ้ำ → ข้อมูลไม่ซ้ำ
8. หมายเหตุขึ้นต้นด้วย `=` → ใน CSV ถูก neutralize

---

## 5. Acceptance Criteria (MVP)

- [x] Login/Logout และสิทธิ์ Admin/Staff ทำงานฝั่ง server
- [x] เพิ่มสินค้าพร้อม OPENING movement
- [x] รับเข้า/เบิกออก/ปรับยอดอัปเดตสต๊อกและประวัติใน transaction เดียว
- [x] ป้องกันเบิกเกินและกันกดซ้ำ
- [x] ประวัติค้นหา/กรอง/แบ่งหน้าได้
- [x] Dashboard แสดงสถานะและรายการที่ควรเติม
- [x] Export CSV ภาษาไทย (BOM) เฉพาะ Admin
- [x] Unit tests ผ่านใน CI; integration tests พร้อมรันบน Neon branch
- [x] Security headers และเอกสาร security/deploy/testing

> E2E อัตโนมัติ (Playwright) ยังไม่ถูกติดตั้งใน MVP นี้ เนื่องจากต้องใช้ฐานข้อมูล
> และ browser ใน CI — แนะนำเพิ่มในรอบถัดไปโดยใช้ Neon branch + seeded test data
