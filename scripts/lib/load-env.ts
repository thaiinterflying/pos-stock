import { existsSync, readFileSync } from 'node:fs';

/** โหลด KEY=VALUE จากไฟล์ env แบบง่าย โดยไม่ทับค่าที่มีอยู่แล้วใน process.env */
export function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadEnvFiles(filePaths: string[] = ['.env.local', '.env']): void {
  for (const filePath of filePaths) {
    loadEnvFile(filePath);
  }
}
