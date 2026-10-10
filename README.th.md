# Alchemy Connect

[English](README.md) · **ภาษาไทย**

ตัวเซิร์ฟเวอร์กับแดชบอร์ดของ Alchemy Connect ไคลเอนต์ Roblox ต่อ WebSocket เข้ามาที่นี่ แล้วจะขึ้นบนหน้าเว็บแบบสด ๆ

เอกสารฝั่งไคลเอนต์ (Lua) อยู่ที่ [connect.getalchemy.net](https://connect.getalchemy.net)

## ต้องมี

- Node.js 20 ขึ้นไป
- npm

## รันตอนพัฒนา

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 แก้ไฟล์แล้วมันรีโหลดเอง

## Build แล้วรันจริง

```bash
npm install
npm run build
npm start
```

เข้าที่เดิม http://localhost:3000

## พอร์ต

ค่าเริ่มต้นคือ 3000 อยากเปลี่ยนก็ใช้ `PORT`

```bash
# macOS / Linux
PORT=4000 npm start

# Windows (PowerShell)
$env:PORT=4000; npm start
```

พอร์ตที่ Roblox ต่อเข้ามา, base URL กับ refresh time ไปตั้งในหน้าเว็บได้เลย (Settings → Connection) ค่าจะเซฟไว้ใน `connect.config.json` ข้าง ๆ `server.ts` ลบไฟล์นี้ทิ้งก็กลับเป็นค่าเริ่มต้น

## ระวังหน่อย

ไม่มีระบบล็อกอิน ใครเข้าพอร์ตนี้ได้ก็เห็นไคลเอนต์และส่งข้อความหาได้หมด ใช้บนเครื่องตัวเองไม่เป็นไร แต่ถ้าจะเปิดออกเน็ต หาอะไรมากั้นไว้ก่อน

## License

MIT ดูที่ [LICENSE](LICENSE) © 2023–2026 Alchemy Hub
