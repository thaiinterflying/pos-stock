import { loadEnvFiles } from './lib/load-env';
import {
  isObjectStorageConfigured,
  runObjectStorageRoundTrip,
} from '../server/lib/object-storage';

loadEnvFiles();

if (!isObjectStorageConfigured()) {
  console.error('✖ ไม่พบ AWS_* env vars สำหรับ Neon Object Storage');
  process.exitCode = 1;
} else {
  try {
    const result = await runObjectStorageRoundTrip();
    console.log('✔ Object Storage ทำงานครบ upload → download → delete');
    console.log(`  bucket: ${result.bucket}`);
    console.log(`  region: ${result.region}`);
    console.log(`  bytes: ${result.bytes}`);
  } catch (error) {
    console.error('✖ Object Storage ทดสอบไม่สำเร็จ');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
