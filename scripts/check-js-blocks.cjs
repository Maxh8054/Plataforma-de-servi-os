#!/usr/bin/env node
/* Checa a sintaxe JS de todos os blocos <script> inline de um HTML */
const fs = require('fs');
const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');

for (const file of process.argv.slice(2)) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  let i = 0, bad = 0;
  for (const m of blocks) {
    const code = m[1];
    if (!code.trim()) continue;
    i++;
    const tmp = path.join(os.tmpdir(), `blk-${path.basename(file)}-${i}.js`);
    fs.writeFileSync(tmp, code);
    try {
      execFileSync('node', ['--check', tmp], { stdio: 'pipe' });
    } catch (e) {
      bad++;
      const msg = String(e.stderr || e.message).split('\n').slice(0, 6).join('\n');
      console.log(`✗ ${file} bloco #${i}:\n${msg}`);
    }
    fs.unlinkSync(tmp);
  }
  console.log(`${bad ? '✗' : '✓'} ${file}: ${i} bloco(s) inline, ${bad} com erro`);
}
