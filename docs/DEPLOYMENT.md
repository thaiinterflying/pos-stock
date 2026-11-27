# Deployment & Operations — TIF Stock

คู่มือ deploy ไปยัง Vercel + Neon PostgreSQL, การ migrate, backup และ recovery

---

## 1. สถาปัตยกรรม Production (แนะนำ)

```text
Browser → Vercel (Next.js 15, Node runtime)
              ├─ Neon PostgreSQL (pooled connection สำหรับ runtime)
              └─ Neon direct connection (migration เท่านั้น)
```

- ใช้ Neon region ใกล้ผู้ใช้ (เช่น `ap-southeast-1` / Singapore)
- ใช้ **pooled endpoint** (`...-pooler...`) เป็น `DATABASE_URL` ของแอป
- ใช้ **direct endpoint** เป็น `DATABASE_URL_UNPOOLED` สำหรับ `drizzle-kit migrate`

---

## 2. เตรียม Environment Variables

ตั้งใน Vercel Project → Settings → Environment Variables:

| Key | จำเป็น | หมายเหตุ |
|---|:---:|---|
| `DATABASE_URL` | ✓ | pooled connection + `?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | แนะนำ | ใช้กับ migration |
| `AUTH_SECRET` | ✓ | ≥ 32 ตัวอักษร สุ่มด้วย `openssl rand -base64 32` |
| `SEED_ADMIN_*` | เฉพาะ seed | ไม่ควรตั้งใน production |

ก่อน deploy ตรวจความพร้อม:

```bash
bun run check:env
```

---

## 3. Migration

### ก่อนเปิดใช้งานครั้งแรก

```bash
# ตั้ง DATABASE_URL_UNPOOLED เป็น direct endpoint ของ production
bun run db:migrate
bun run db:seed      # สร้าง Admin คนแรก (รหัสผ่านจะแสดงครั้งเดียว)
```

> `db:migrate` ใช้ `scripts/migrate.ts` + `pg` กับ `DATABASE_URL_UNPOOLED` (direct)
> และตัด `channel_binding` ที่ `pg` ไม่รองรับออกให้อัตโนมัติ
> ควร backup/PITR ให้พร้อมก่อน migrate ทุกครั้ง

### การเปลี่ยน schema ในอนาคต

1. แก้ `server/db/schema.ts`
2. `bun run db:generate` → review SQL ใน `drizzle/`
3. ทดสอบ migrate บน Neon branch ก่อน
4. ใช้รูปแบบ **expand → migrate → contract** สำหรับการเปลี่ยนที่กระทบข้อมูล
5. Migration เป็น forward-only — ไม่แก้ไฟล์ migration ที่ apply แล้ว

---

## 4. Deploy บน Vercel

1. Import repository เข้า Vercel
2. ตั้งค่า:
   - Install Command: `bun install`
   - Build Command: `bun run build`
   - Node.js Runtime (ไม่ใช้ Edge สำหรับ auth/DB)
3. ตั้ง Environment Variables ตามข้อ 2
4. Deploy
5. หลัง deploy ตรวจ:
   - `GET /api/health` → `{ "status": "ok", "database": "up", "storage": "up" }`
   - Login Admin/Staff ได้
   - Security headers (CSP/HSTS) ถูกส่งใน production
   - Export CSV เปิดใน Excel ได้และภาษาไทยถูกต้อง

---

## 5. Rollback

| กรณี | แนวทาง |
|---|---|
| โค้ดมีปัญหา | Redeploy deployment ก่อนหน้าจาก Vercel |
| Migration ผิดพลาด | หยุดรับ traffic, restore จาก PITR/backup, แล้ว deploy โค้ดที่เข้ากัน |
| ข้อมูลเสียหาย | ใช้ Neon PITR สร้าง branch ณ เวลาก่อนเกิดเหตุ → ตรวจสอบ → สลับ endpoint |

> หลีกเลี่ยงการ rollback schema ด้วยการลบ column ทันที — ใช้ expand/contract เพื่อให้โค้ดเก่าและใหม่ทำงานร่วมกันได้

---

## 6. Backup และ Recovery

### Neon PITR

- เปิดใช้ Point-in-Time Restore ตามแผนของ Neon
- ตรวจสอบ retention ใน Neon Console
- ก่อน migrate/เปลี่ยนแปลงสำคัญ: สร้าง branch สำรองหรือบันทึก restore point

### pg_dump รายวัน (สำรองนอกระบบ)

```bash
pg_dump "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" \
  -Fc -f "backup_$(date +%F).dump"
```

- เก็บไฟล์ใน storage ที่เข้ารหัสและจำกัดสิทธิ์
- ควรมี retention อย่างน้อย 7–30 วันตามนโยบาย

### ซ้อม Restore (ทำอย่างน้อยไตรมาสละครั้ง)

```bash
# สร้างฐานข้อมูล/ branch ใหม่แล้ว restore
pg_restore -d "postgresql://.../restore_target" --clean --if-exists backup_YYYY-MM-DD.dump
```

ตรวจสอบหลัง restore:

- จำนวนผู้ใช้/สินค้า/stock movements
- ผลรวม `quantity_after` ของรายการล่าสุดตรงกับ `products.current_stock`
- ทดสอบ login และรับเข้า/เบิกออกบน environment ที่ restore

---

## 7. Monitoring และ Maintenance

- ตรวจ `/api/health` เป็น periodic check (uptime monitor)
- ตรวจ Neon metrics: connection count, CPU, storage
- Session หมดอายุจะถูกเก็บกวาดเมื่อมี login ใหม่; หากไม่มี login นานสามารถรัน:
  ```sql
  DELETE FROM sessions WHERE expires_at < now();
  ```
- `login_attempts` ถูก prune อัตโนมัติเมื่อมี login (เก็บ 24 ชั่วโมง)
- อัปเดต dependency เป็นรอบ และรัน `bun audit`
- ตรวจ log ฝั่ง Vercel สำหรับ error digest ที่ผู้ใช้รายงาน

---

## 8. Checklist ก่อน Go-Live

- [ ] ตั้ง production env ครบและผ่าน `bun run check:env`
- [ ] migrate + seed Admin เรียบร้อย (`bun run db:check` เห็น 6 ตาราง)
- [ ] `bun run check:storage` ผ่าน (bucket `assets`)
- [ ] เปลี่ยนรหัสผ่าน seed และสร้างบัญชีจริง
- [ ] เปิด PITR และทดสอบ restore บน branch
- [ ] ตรวจ `/api/health` (database + storage), security headers, login ทั้ง 2 บทบาท
- [ ] ทดสอบรับเข้า/เบิกออก/ปรับยอด และ Export CSV
- [ ] ตั้ง uptime monitor
- [ ] เอกสารส่งมอบและผู้รับผิดชอบ backup ชัดเจน
