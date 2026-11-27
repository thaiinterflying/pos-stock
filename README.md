# TIF Stock

ระบบจัดการสต๊อกอุปกรณ์สำนักงานภายในองค์กร สำหรับ **Thai Inter Flying**
รองรับการรับเข้า เบิกออก ปรับยอดหลังตรวจนับ และดูประวัติการเคลื่อนไหว
พร้อมสิทธิ์ผู้ใช้ 2 ระดับ (Admin / Staff)

> สถานะปัจจุบัน: **Phase 5 — Testing, Security Review and Documentation (MVP complete)**

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Runtime / Package Manager | Bun |
| Styling | Tailwind CSS 4 + shadcn/ui + Lucide Icons |
| Database | Neon PostgreSQL (`@neondatabase/serverless` WebSocket Pool) |
| Object Storage | Neon Object Storage bucket `assets` (private) via `@aws-sdk/client-s3` |
| ORM | Drizzle ORM + drizzle-kit |
| Validation | Zod |
| Auth | Session cookie (HttpOnly) + Argon2id |
| Toast | Sonner |

---

## ฟีเจอร์ที่ใช้งานได้แล้ว (Phase 1–5)

- เข้าสู่ระบบ/ออกจากระบบด้วย Session, สิทธิ์ Admin/Staff, จัดการผู้ใช้
- จัดการหมวดหมู่: เพิ่ม/แก้ไข/เปิด-ปิดใช้งาน (ห้ามปิดถ้ามีสินค้าที่ใช้งานอยู่)
- จัดการสินค้า: เพิ่มพร้อมยอดยกมา, แก้ไข, เปิด-ปิดใช้งานแทนการลบ
- แก้จำนวนคงเหลือจากหน้าแก้ไขสินค้า (Admin) โดยต้องระบุเหตุผล — ระบบบันทึกเป็น ADJUSTMENT อัตโนมัติ
- รูปสินค้า 1 รูป (JPG/PNG/WebP ≤ 2 MB) เก็บใน Neon Object Storage แบบ private
  พร้อม thumbnail ในรายการสินค้า — อัปโหลด/เปลี่ยน/ลบได้เฉพาะ Admin, Staff ดูได้
- ค้นหาชื่อ/SKU, กรองตามหมวดหมู่/สถานะสต๊อก, แบ่งหน้า
- สถานะสต๊อกคำนวณสด: ปกติ / ใกล้หมด / หมดสต๊อก
- หน้ารายละเอียดสินค้า และประวัติการเคลื่อนไหวของสินค้านั้น
- รับเข้า / เบิกออก / ปรับยอด พร้อมพรีวิวยอดก่อน–หลัง และบันทึกประวัติอัตโนมัติ
- ป้องกันเบิกเกินยอด, กันกดซ้ำ (atomic transaction + idempotency key) และตรวจสิทธิ์ฝั่ง server
- หน้าประวัติรวม พร้อมค้นหาสินค้า กรองประเภท/ช่วงวันที่ (เวลาไทย) และแบ่งหน้า
- Dashboard แสดงสินค้าที่ควรเติม (พร้อมปุ่มรับเข้า) และความเคลื่อนไหวล่าสุด
- Export CSV (UTF-8 BOM) และ Excel (.xlsx) สำหรับ Admin ตามตัวกรองเดียวกับหน้าประวัติ
- Security headers (CSP/HSTS), robots noindex และ CI (typecheck + tests + build)
- Dashboard สรุปจำนวน SKU ตามสถานะ (กดการ์ดเพื่อไปยังรายการที่กรองแล้ว)

---

## ภาพพื้นหลังหน้า Login

ภาพพื้นหลังอยู่ที่ `public/images/login-background.jpg` (1920px, ~256 KB) พร้อม overlay
ให้ฟอร์มและข้อความอ่านง่าย ทั้ง desktop และ mobile

- ต้องการเปลี่ยนภาพ: วางไฟล์ทับชื่อเดิม (`login-background.jpg` หรือ `.png`)
- ถ้าไม่มีไฟล์ ระบบจะใช้ gradient สีน้ำเงินแทน (หน้าเว็บไม่พัง)
- `/images/*` ถูกยกเว้นจาก middleware เพื่อให้ภาพโหลดได้ก่อน login

---

## สิ่งที่ต้องมี

- [Bun](https://bun.sh) 1.1 ขึ้นไป
- บัญชี [Neon](https://neon.tech) และโปรเจกต์ PostgreSQL
- Node.js 20 ขึ้นไป (Bun ใช้รัน Next.js ได้ แต่บาง tooling ใช้ Node)

---

## การติดตั้ง

### 1. ติดตั้ง dependencies

```bash
bun install
```

### 2. สร้างฐานข้อมูลบน Neon

1. สร้างโปรเจกต์ใหม่ใน Neon (แนะนำ region `ap-southeast-1`/Singapore)
2. คัดลอก connection string 2 แบบจากหน้า **Connect**:
   - **Pooled connection** (host มี `-pooler`) → ใช้เป็น `DATABASE_URL`
   - **Direct connection** (ไม่มี `-pooler`) → ใช้เป็น `DATABASE_URL_UNPOOLED` สำหรับ migration
3. ตรวจสอบว่ามี `?sslmode=require` ต่อท้าย

### 3. ตั้งค่า environment

```bash
# macOS / Linux / Git Bash
cp .env.example .env.local

# PowerShell
Copy-Item .env.example .env.local
```

แก้ไข `.env.local`:

```env
DATABASE_URL="postgresql://...-pooler.../tifstock?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://.../tifstock?sslmode=require"
AUTH_SECRET="<สุ่มด้วย openssl rand -base64 32>"
```

### 4. รัน migration

```bash
bun run db:migrate
```

### 5. สร้างบัญชีเริ่มต้น (seed)

```bash
bun run db:seed
```

สคริปต์จะสร้าง Admin และ Staff ตามค่าใน `.env.local`
ถ้าไม่ได้กำหนดรหัสผ่าน ระบบจะ **สุ่มรหัสผ่านและพิมพ์ออกทางหน้าจอเพียงครั้งเดียว**
กรุณาบันทึกไว้ทันที

### 6. เริ่ม development server

```bash
bun run dev
```

เปิด <http://localhost:3000> แล้วเข้าสู่ระบบด้วยบัญชีที่ seed ไว้

### ตั้งค่าด้วย Neon CLI (ทางเลือก)

ถ้าใช้ `neon.ts` เป็น infrastructure-as-code:

```bash
npm i -g neon@latest
neon login
neon init -y --org-id <org-id> --project-id <project-id> --branch production --services postgres,object-storage
neon deploy
```

`neon deploy` จะ:

- provision bucket `assets` ตาม `neon.ts`
- pull `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AWS_*` และ `NEON_BRANCH*` ลง `.env.local`

หลัง deploy ให้เพิ่ม `AUTH_SECRET` ใน `.env.local` แล้วรัน:

```bash
bun run db:migrate
bun run db:check
bun run db:seed
bun run check:storage
bun run check:image
bun run check:env
```

> Object Storage ถูกใช้กับ **รูปสินค้า** (`products/{uuid}.{ext}` ใน bucket `assets`)
> และตรวจสอบใน `/api/health` / `scripts/check-storage.ts`
> รูปเสิร์ฟผ่าน `/api/products/[id]/image` ซึ่งต้อง login ทุกครั้ง (bucket ไม่ได้เปิด public)

เหตุผลที่เลือกใช้บริการเหล่านี้:

- **`DATABASE_URL` (pooled)** ใช้กับแอป เพราะ serverless runtime เปิด connection บ่อย
  จึงต้องผ่าน PgBouncer เพื่อไม่ให้เกิน connection limit ของ compute
- **`DATABASE_URL_UNPOOLED` (direct)** ใช้เฉพาะ migration/seed/สคริปต์ CLI
  เพราะ PgBouncer transaction mode ไม่รองรับ session-level features ที่ Drizzle migrator ต้องใช้
- **`@neondatabase/serverless`** ใช้ WebSocket `Pool` คู่กับ `drizzle-orm/neon-serverless`
  เพื่อให้ได้ **interactive transaction** (BEGIN → UPDATE … RETURNING → INSERT movement → COMMIT)
  ตามข้อกำหนดเรื่อง atomic stock update; ฝั่ง HTTP driver (`neon-http`) ไม่รองรับ transaction
  แบบ interactive จึงไม่ใช้กับฟีเจอร์รับเข้า/เบิกออก

---

## Scripts

| คำสั่ง | รายละเอียด |
|---|---|
| `bun run dev` | รันโหมดพัฒนา |
| `bun run build` | build สำหรับ production |
| `bun run start` | รัน production build |
| `bun run typecheck` | ตรวจ TypeScript ทั้งโปรเจกต์ |
| `bun run test` | unit + integration tests (integration จะ skip หากไม่มี env) |
| `bun run check:env` | ตรวจความพร้อมของ environment ก่อน deploy |
| `bun run db:check` | ตรวจการเชื่อมต่อฐานข้อมูล + จำนวนตารางหลัก |
| `bun run check:storage` | ทดสอบ Object Storage (upload → download → delete) |
| `bun run check:image` | ทดสอบฟอร์มแก้ไขสินค้า E2E (รูป + ปรับจำนวนคงเหลือ + ตรวจ movement + cleanup) |
| `bun run smoke` | Smoke test E2E กับ production build (ต้องมี `SMOKE_*` env vars) |
| `bun run test:unit` | unit tests เท่านั้น |
| `bun run test:integration` | integration tests กับ Neon branch (ต้องมี `TEST_DATABASE_URL`) |
| `bun run db:generate` | สร้าง migration จาก schema |
| `bun run db:migrate` | รัน migration ผ่าน direct endpoint (script + `pg`) |
| `bun run db:studio` | เปิด Drizzle Studio ดูข้อมูล |
| `bun run db:seed` | สร้างผู้ใช้เริ่มต้น |

---

## โครงสร้างโปรเจกต์

```
app/
  (auth)/login/          # หน้าเข้าสู่ระบบ
  (app)/                 # หน้าที่ต้อง login (มี sidebar/topbar)
    dashboard/           # แดชบอร์ดสรุปสถานะสต๊อก
    products/            # รายการ + ค้นหา/ตัวกรอง + เพิ่ม/แก้ไข/รายละเอียด
    history/             # ประวัติการเคลื่อนไหวทั้งระบบ + ตัวกรอง
    settings/users/      # จัดการผู้ใช้ (Admin)
    settings/categories/ # จัดการหมวดหมู่ (Admin)
  api/health/            # ตรวจสอบการเชื่อมต่อฐานข้อมูล
  api/export/stock-movements/ # Export CSV (Admin เท่านั้น)
components/
  ui/                    # shadcn/ui primitives
  layout/                # sidebar, topbar, brand
  auth/ dashboard/ settings/ shared/
  dashboard/             # การ์ดสถิติ, สินค้าที่ควรเติม, ความเคลื่อนไหวล่าสุด
  products/              # ฟอร์มสินค้า, ตัวกรอง, ตาราง, สถานะสต๊อก
  stock/                 # dialogs รับเข้า/เบิกออก/ปรับยอด + ปุ่มลัด + badge
  history/               # ตัวกรองและตารางประวัติการเคลื่อนไหว
server/
  db/                    # schema, relations, connection (lazy)
  auth/                  # password, session, guard, rate limit, authorize
  actions/               # Server Actions (auth, users, products, categories, stock)
  queries/               # read queries (products, categories, users, dashboard, stock history)
  lib/                   # result helpers, request helpers, stock service (atomic + idempotency), CSV
validations/             # Zod schemas
scripts/seed.ts          # seed ผู้ใช้
drizzle/                 # migration ที่ generate แล้ว
tests/unit/              # unit tests
tests/integration/       # integration tests (ข้ามถ้าไม่มี TEST_DATABASE_URL)
docs/                    # SECURITY / DEPLOYMENT / TESTING
.github/workflows/ci.yml # CI: typecheck + unit tests + build
middleware.ts            # optimistic auth redirect
```

---

## เอกสารเพิ่มเติม

- [docs/SECURITY.md](docs/SECURITY.md) — threat model, authorization matrix, ผล security review
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploy, migration, rollback, backup/restore
- [docs/TESTING.md](docs/TESTING.md) — แผนทดสอบ, integration tests, manual E2E

---

## Production Hardening

- Security headers ถูกส่งจาก `next.config.ts` (CSP/HSTS เฉพาะ production)
- ปิด `X-Powered-By` และตั้ง `robots.txt` แบบ disallow ทั้งระบบ
- CI ที่ `.github/workflows/ci.yml` รัน typecheck + unit tests + build ทุก push/PR
- ก่อน deploy ให้รัน `bun run check:env` และตรวจ `/api/health` หลัง deploy

---

## การออกแบบด้านความปลอดภัย (สรุป)

- **Password hashing**: Argon2id (memory 19 MiB, timeCost 2)
- **Session**: token สุ่ม 32 bytes, เก็บเฉพาะ SHA-256 hash ในตาราง `sessions`
- **Cookie**: `HttpOnly`, `SameSite=Lax`, `Secure` ใน production, อายุ 8 ชั่วโมง
- **Authorization ฝั่ง server**: ทุกหน้าภายในเรียก `requireUser()` และหน้าตั้งค่าเรียก `requireAdmin()`
  (การซ่อนเมนูเป็นเพียง UX ไม่ใช่การป้องกัน)
- **Brute force**: ผิด 5 ครั้ง/อีเมล หรือ 20 ครั้ง/IP ภายใน 15 นาที จะถูกระงับ
  โดยเก็บเฉพาะ HMAC ของอีเมลใน `login_attempts`
- **Enumeration**: ข้อความ error ระหว่าง login ไม่บอกว่าอีเมลมีอยู่จริงหรือไม่
- **Session revocation**: ออกจากระบบเมื่อปิดใช้งานผู้ใช้หรือรีเซ็ตรหัสผ่าน
- **กัน admin คนสุดท้าย**: ห้ามปิดใช้งาน/ลดสิทธิ์ admin คนสุดท้าย และห้ามปิดบัญชีตัวเอง

ฐานข้อมูลมี constraint ป้องกันข้อมูลเพี้ยนตั้งแต่ระดับ DB:
`current_stock >= 0`, `quantity_after = quantity_before + quantity_change`,
`OUT` ต้องมีชื่อผู้เบิก, `ADJUSTMENT` ต้องมีเหตุผล, FK เป็น `RESTRICT`
(ประวัติการเคลื่อนไหวจะไม่ถูกลบเมื่อลบสินค้า/ผู้ใช้ — และแอปไม่มีปุ่มลบประวัติ)

---

## การทดสอบ Phase 1–5

### อัตโนมัติ

```bash
bun run typecheck
bun run test
bun run build
```

### Manual checklist

1. **Login ผิดรหัส** → แสดงข้อความกลาง ๆ ว่า "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
2. **Login ผิดติดกัน 6 ครั้ง** → ถูกจำกัดด้วยข้อความให้รอ 15 นาที
3. **Login สำเร็จ** → ไปที่ `/dashboard` และเห็นชื่อผู้ใช้ + สถิติ 4 การ์ด
4. **ตรวจ cookie** ใน DevTools → `tif_session` ต้องเป็น HttpOnly และไม่มีค่า token ใน DB
5. **Admin** → เห็นเมนู "ตั้งค่า", เพิ่มผู้ใช้, แก้ไขชื่อ/บทบาท, รีเซ็ตรหัสผ่าน, เปิด-ปิดใช้งาน
6. **Staff** → ไม่เห็นเมนูตั้งค่า และเข้า `/settings/users` ตรง ๆ จะถูกพาไป `/dashboard?forbidden=1`
7. **ปิดใช้งานผู้ใช้** → ผู้ใช้นั้นถูกเตะออกจากระบบทันที (session ถูกลบ)
8. **Admin คนสุดท้าย** → ระบบไม่ยอมให้ปิดใช้งานหรือลดสิทธิ์
9. **`/api/health`** → คืน `{ "status": "ok", "database": "up" }`
10. **Mobile** → sidebar เปิดเป็น drawer และตารางผู้ใช้/สินค้าเลื่อนแนวนอนได้

### Phase 2 checklist

1. **สร้างหมวดหมู่** → แสดงในรายการ และตั้งชื่อซ้ำ (ต่างตัวพิมพ์ใหญ่/เล็ก) ถูกปฏิเสธ
2. **ปิดใช้งานหมวดหมู่ที่มีสินค้าใช้งาน** → ถูกบล็อกพร้อมข้อความอธิบาย
3. **เพิ่มสินค้า** ด้วย SKU ตัวพิมพ์เล็ก → บันทึกเป็นตัวพิมพ์ใหญ่ และ SKU ซ้ำถูกปฏิเสธ
4. **ยอดเริ่มต้น 10** → หน้ารายละเอียดมีประวัติ `OPENING` ก่อน 0 → หลัง 10 และคงเหลือ 10
5. **แก้ไขสินค้า** → ไม่มีช่องแก้ `current_stock`; ยอดคงเหลือไม่เปลี่ยน; แก้ Min Stock แล้วสถานะเปลี่ยนตาม
6. **ค้นหา/กรอง** ตามชื่อ, SKU, หมวดหมู่ และสถานะ พร้อม pagination ที่คงตัวกรองไว้
7. **Staff** → ไม่เห็นปุ่มเพิ่ม/แก้ไขสินค้า และเข้า `/products/new` หรือ `/products/[id]/edit` ตรง ๆ จะถูกพากลับ
8. **ปิดใช้งานสินค้า** → หายจากรายการปกติ แต่ Admin ยังเห็นเมื่อติ๊ก "รวมสินค้าที่ปิดใช้งาน"
9. **สถานะสต๊อก** → 0 = หมดสต๊อก, 1..min = ใกล้หมด, > min = ปกติ
10. **กรอก SKU ซ้ำ / จำนวนติดลบ** → ฟอร์มแสดง error ใต้ช่องที่ผิด

### Phase 3 checklist

1. **รับเข้า** จากปุ่มบนรายการสินค้า → ยอดเพิ่มตามจำนวน, มียอดก่อน/หลัง และผู้ดำเนินการถูกต้อง
2. **เบิกออก** → ต้องระบุชื่อผู้เบิก, แผนกและหมายเหตุถูกบันทึก, ยอดลดลงตามจำนวน
3. **เบิกเกินยอดคงเหลือ** → ปุ่มยืนยันถูกปิดฝั่ง client และ server ตอบ `INSUFFICIENT_STOCK`
4. **กดยืนยันซ้ำ/เน็ตช้า** → ไม่เกิดรายการซ้ำหรือตัดสต๊อกซ้ำ (unique `request_id`)
5. **ปรับยอด** (Admin) → ต้องระบุเหตุผล, ผลต่างถูกต้อง, ถ้ายอดตรงระบบจะไม่สร้างรายการ
6. **Staff** → เห็นปุ่มรับเข้า/เบิกออก แต่ไม่เห็นปุ่มปรับยอด และเรียก action ปรับยอดตรง ๆ ไม่ได้
7. **ปิดใช้งานสินค้า** → ปุ่มเคลื่อนไหวสต๊อกถูกปิด และ server ปฏิเสธ
8. **ประวัติ** → ค้นหาชื่อ/SKU, กรองประเภทและช่วงวันที่ตามเวลาไทย, แบ่งหน้าคงตัวกรอง
9. **ประวัติแก้ไข/ลบไม่ได้** → ไม่มี UI และ FK เป็น RESTRICT
10. **ตัวเลขหลังทำรายการ** → การ์ด Dashboard และ badge สถานะอัปเดตทันทีหลัง refresh

### Phase 4 checklist

1. **Dashboard** → การ์ด 4 ใบกดได้และพาไปยังรายการที่กรองแล้ว
2. **สินค้าที่ควรเติม** → แสดงเฉพาะ `stock <= min_stock` (รวมของหมด) เรียงของหมดก่อน
3. **ปุ่มรับเข้าบน Dashboard** → บันทึกแล้วยอด/สถานะอัปเดตทันที
4. **ความเคลื่อนไหวล่าสุด** → แสดง 6 รายการล่าสุด พร้อมลิงก์ไปหน้าประวัติ
5. **Export CSV (Admin)** → ไฟล์เปิดใน Excel ภาษาไทยถูกต้อง (มี UTF-8 BOM)
6. **Export ตามตัวกรอง** → เลือกสินค้า/ประเภท/ช่วงวันที่แล้ว Export ได้ตรงกับรายการบนจอ
7. **Staff** → ไม่เห็นปุ่ม Export และเรียก `/api/export/stock-movements` ตรง ๆ ได้ 403
8. **CSV injection** → หมายเหตุที่ขึ้นต้นด้วย `=` ถูกเติม apostrophe และไม่ถูกตีความเป็นสูตร
9. **Responsive** → Dashboard/History/สินค้าใช้งานได้บนจอ 375px โดยไม่ล้น
10. **Empty state** → เมื่อไม่มีสินค้าหรือไม่มีการเคลื่อนไหว แสดงข้อความและทางลัดที่เหมาะสม

### Phase 5 checklist

1. **Unit tests** → `bun run test:unit` ผ่านทั้งหมด (session/validation/stock/CSV/date)
2. **Integration tests** → รัน `bun run test:integration` บน Neon branch ที่ migrate แล้ว (concurrency + idempotency)
3. **CI** → push/PR แล้ว typecheck, unit tests และ build ผ่าน
4. **Environment** → `bun run check:env` ผ่านก่อน deploy
5. **Security headers** → ตรวจ CSP/HSTS/X-Frame-Options ใน production response
6. **Dependency audit** → รัน `bun audit` และบันทึกผลในรอบ release
7. **Backup drill** → ทดสอบ restore จาก PITR/pg_dump บน branch แยก
8. **Docs review** → SECURITY/DEPLOYMENT/TESTING ตรงกับระบบจริง
9. **Accessibility พื้นฐาน** → ปุ่ม/ฟอร์มมี label, dialog มี title/description
10. **Smoke test หลัง deploy** → login 2 บทบาท, รับเข้า/เบิกออก, Export CSV, `/api/health`

---

## Backup & Recovery

- Neon มี **Point-in-Time Restore** ตามแผนที่ใช้ — ควรตรวจสอบ retention ใน Neon Console
- สำรองเพิ่มเติมแบบรายวันด้วย `pg_dump` ไปยัง storage ภายนอก:

```bash
pg_dump "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" -Fc -f backup_$(date +%F).dump
```

- ซ้อม restore อย่างน้อยหนึ่งครั้งก่อนใช้งานจริง:

```bash
pg_restore -d "postgresql://.../restore_target" --clean --if-exists backup_YYYY-MM-DD.dump
```

- ห้าม commit `.env.local` หรือ connection string ลงใน git

---

## Deployment (แนวทาง)

1. สร้างโปรเจกต์บน Vercel และเชื่อม repository
2. ตั้งค่า Environment Variables: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`
3. Build command: `bun run build` (กำหนด install command เป็น `bun install`)
4. รัน `bun run db:migrate` กับฐานข้อมูล production ก่อนเปิดใช้งาน
5. ตั้งค่า backup/PITR บน Neon และตรวจ `/api/health` หลัง deploy

---

## หลัง MVP (ข้อเสนอแนะ)

- เพิ่ม Playwright E2E ใน CI ด้วย Neon branch + seeded data
- MFA สำหรับ Admin และ nonce-based CSP
- Audit log สำหรับการจัดการผู้ใช้
- แจ้งเตือน LINE/Email เมื่อสินค้าใกล้หมด (นอกขอบเขต MVP ปัจจุบัน)

> ฟีเจอร์นอกขอบเขต MVP เช่น POS, PO, หลายคลัง, barcode/QR และระบบยืมคืน ยังไม่ถูกพัฒนา

---

## Troubleshooting

| อาการ | สาเหตุ/วิธีแก้ |
|---|---|
| `ไม่พบ DATABASE_URL` | ยังไม่ได้สร้าง `.env.local` หรือไฟล์อยู่ผิดตำแหน่ง |
| `/api/health` คืน 503 | connection string ผิด, ใช้ pooled endpoint ไม่ถูก, หรือ Neon ถูก suspend |
| `db:migrate` ล้มเหลว | ต้องใช้ `DATABASE_URL_UNPOOLED` (direct connection) กับ drizzle-kit |
| Login แล้วกลับหน้า login | cookie ถูกบล็อก (ต้องใช้ http://localhost หรือ HTTPS) หรือ session หมดอายุ |
| SKU ซ้ำ | SKU ถูก normalize เป็นตัวพิมพ์ใหญ่และต้องไม่ซ้ำกับสินค้าใด ๆ แม้ถูกปิดใช้งาน |
| ปิดหมวดหมู่ไม่ได้ | ต้องย้ายหรือปิดใช้งานสินค้าที่ใช้งานอยู่ในหมวดนั้นก่อน |
| Export CSV ไม่ครบ | ระบบจำกัด 50,000 แถวต่อครั้ง — ใช้ตัวกรองช่วงวันที่เพื่อแบ่ง Export |
