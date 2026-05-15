// Tests pour #257 — MIME types corrects (.webmanifest, .xml)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveDashboard, MIME } from '../lib/dashboard/server.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-mime-')); }

// (#282) Ephemeral port (port: 0)
test('serveDashboard — port=0 → bind éphémère, lit port réel via address()', async () => {
  const dir = tmp();
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    const { server, port, url } = await serveDashboard(dir, { port: 0, quiet: true });
    try {
      // Port assigné par OS doit être > 0 et < 65536
      assert.ok(port > 0 && port < 65536, `port hors range: ${port}`);
      // URL contient le port réel
      assert.match(url, new RegExp(`http://127\\.0\\.0\\.1:${port}/$`));
      // Le serveur répond
      const r = await fetch(url);
      assert.equal(r.status, 200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('MIME — .webmanifest = application/manifest+json (PWA spec W3C)', () => {
  assert.match(MIME['.webmanifest'], /application\/manifest\+json/);
});

test('MIME — .xml = text/xml (sitemap.xml)', () => {
  assert.match(MIME['.xml'], /xml/);
});

// (#310) --quiet doit faire taire le banner "Dashboard servi en local …"
// pour les jobs CI / scripts d'orchestration qui pipent stdout.
test('serveDashboard — quiet:true → aucun banner stdout (Unix pattern)', async () => {
  const dir = tmp();
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    // Intercepte console.log pendant le listen.
    const captured = [];
    const original = console.log;
    console.log = (...args) => { captured.push(args.join(' ')); };
    let server;
    try {
      ({ server } = await serveDashboard(dir, { port: 0, quiet: true }));
    } finally {
      console.log = original;
    }
    try {
      assert.equal(captured.length, 0, `aucun banner attendu, reçu : ${JSON.stringify(captured)}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('serveDashboard — sans quiet → banner stdout présent (sanity)', async () => {
  const dir = tmp();
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    const captured = [];
    const original = console.log;
    console.log = (...args) => { captured.push(args.join(' ')); };
    let server;
    try {
      ({ server } = await serveDashboard(dir, { port: 0 }));
    } finally {
      console.log = original;
    }
    try {
      const joined = captured.join('\n');
      assert.match(joined, /Dashboard servi en local/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('serveDashboard — manifest.webmanifest servi avec Content-Type application/manifest+json', async () => {
  const dir = tmp();
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"test"}');
    writeFileSync(join(dir, 'sitemap.xml'), '<?xml version="1.0"?><urlset/>');
    // (#282) Port=0 éphémère + quiet pour ne pas polluer le test output.
    const { server, port } = await serveDashboard(dir, { port: 0, quiet: true });
    try {
      const r1 = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
      assert.equal(r1.status, 200);
      assert.match(r1.headers.get('content-type'), /application\/manifest\+json/);
      const r2 = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
      assert.equal(r2.status, 200);
      assert.match(r2.headers.get('content-type'), /xml/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
