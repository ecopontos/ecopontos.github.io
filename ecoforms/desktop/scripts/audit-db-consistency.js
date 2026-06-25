#!/usr/bin/env node
// Audits SQL queries across the codebase for status values that don't match domain enums.
// Focuses on task-related queries to avoid false positives from other domains
// (modules use draft/published/archived, sync queue uses pending/failed, etc.)

const fs = require('fs');
const path = require('path');

const DOMAINS = [
  {
    name: 'TaskStatus',
    valid: ['a_fazer', 'em_progresso', 'concluido', 'cancelado'],
    invalid: ['done', 'cancelled', 'archived', 'pending', 'in_progress', 'completed'],
    context: /tarefas|task/i,
    ignoreFiles: [/test\/fakes/, /_deprecated/, /Module/, /module/],
  },
];

const rootDir = path.resolve(__dirname, '..');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const ignoreDirs = ['node_modules', '.next', 'src-tauri/target', '_deprecated'];

let issues = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (extensions.includes(path.extname(entry.name))) {
      checkFile(full);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const rel = path.relative(rootDir, filePath);

  for (const domain of DOMAINS) {
    if (domain.ignoreFiles.some(re => re.test(rel))) continue;

    const isRelevantFile = domain.context.test(rel);

    lines.forEach((line, i) => {
      if (!line.includes('status') && !line.includes('STATUS')) return;

      const isRelevantLine = domain.context.test(line) || isRelevantFile;
      if (!isRelevantLine) return;

      for (const bad of domain.invalid) {
        const pattern = new RegExp(`'${bad}'|"${bad}"`);
        if (pattern.test(line)) {
          console.log(`[${domain.name}] ${rel}:${i + 1}  found "${bad}" (expected: ${domain.valid.join(', ')})`);
          console.log(`           ${line.trim()}`);
          issues++;
        }
      }
    });
  }
}

console.log('=== EcoForms DB Consistency Audit ===\n');
console.log(`Scanning: ${rootDir}\n`);
for (const d of DOMAINS) {
  console.log(`  ${d.name}: valid=[${d.valid.join(', ')}]  invalid=[${d.invalid.join(', ')}]`);
}
console.log();

walk(path.join(rootDir, 'src'));
walk(path.join(rootDir, 'app'));

console.log(`\n=== Done: ${issues} issue(s) found ===`);
process.exit(issues > 0 ? 1 : 0);
