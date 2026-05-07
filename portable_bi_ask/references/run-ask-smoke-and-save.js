#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const runner = path.join('references', 'run-ask-smoke.js');
const artifact = path.join(root, 'references', 'smoke-last-result.json');

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
}

let result = run('playwright-cli', ['--raw', 'run-code', `--filename=${runner}`]);
if (result.error && result.error.code === 'ENOENT') {
  result = run('npx', ['--no-install', 'playwright-cli', '--raw', 'run-code', `--filename=${runner}`]);
}

const stdout = (result.stdout || '').trim();
const stderr = (result.stderr || '').trim();
let report;
try {
  report = stdout ? JSON.parse(stdout) : null;
} catch (error) {
  report = null;
}

if (!report) {
  report = {
    reportVersion: 1,
    timestamp: new Date().toISOString(),
    ok: false,
    passCount: 0,
    failCount: 1,
    summary: { total: 0, passed: 0, failed: 1, consoleErrors: 0 },
    failures: [{ id: 'smoke_runner', kind: 'runner', failures: [stderr || stdout || String(result.error || 'Unknown smoke runner failure')] }],
    browserConsoleErrors: [],
    results: []
  };
}

report.command = `playwright-cli --raw run-code --filename=${runner}`;
report.exitCode = result.status ?? (report.ok ? 0 : 1);
if (stderr) report.stderr = stderr;

fs.mkdirSync(path.dirname(artifact), { recursive: true });
fs.writeFileSync(artifact, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok && result.status === 0 ? 0 : 1);
