import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', 'desktop', 'hooks', 'usePermissions.ts');
if (!fs.existsSync(file)) {
  console.error('usePermissions.ts not found at expected path:', file);
  process.exit(2);
}

const src = fs.readFileSync(file, 'utf8');

let ok = true;

// Check role exists
if (!/\bencarregado\b/.test(src)) {
  console.error("FAIL: role 'encarregado' not found in usePermissions.ts");
  ok = false;
} else {
  console.log("OK: 'encarregado' role present");
}

// Check permission mapping for tasks.reassign
const match = src.match(/"tasks.reassign"\s*:\s*\[([^\]]*)\]/m);
if (!match) {
  console.error("FAIL: 'tasks.reassign' mapping not found in PERMISSIONS_MAP");
  ok = false;
} else {
  const roles = match[1].split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean);
  console.log("Found roles for tasks.reassign:", roles);
  if (!roles.includes('encarregado')) {
    console.error("FAIL: 'encarregado' is not listed for 'tasks.reassign'.");
    ok = false;
  } else {
    console.log("OK: 'encarregado' is included for 'tasks.reassign'");
  }
}

// Quick sanity check: ensure hasPermission will check PERMISSIONS_MAP (simple pattern match)
if (!/const\s+hasPermission\s*=\s*\(permission: Permission\)/.test(src) && !/hasPermission\s*=\s*\(permission: Permission\)/.test(src)) {
  console.warn("WARN: could not find hasPermission signature (unexpected, but permission mapping may still be used)");
} else {
  console.log('OK: hasPermission function present');
}

if (!ok) process.exit(1);
console.log('All checks passed.');
process.exit(0);
