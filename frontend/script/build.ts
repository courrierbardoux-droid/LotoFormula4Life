import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function buildProject() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🔨 LOTOFORMULA4LIFE BUILD 🔨                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // ============================================
  // ÉTAPE 1: Build du frontend (Vite)
  // ============================================
  
  console.log('📦 [1/3] Building frontend with Vite...');
  try {
    execSync('npx vite build', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Frontend build complete!\n');
  } catch (error) {
    console.error('❌ Frontend build failed!');
    process.exit(1);
  }

  // ============================================
  // ÉTAPE 2: Build du backend (esbuild)
  // ============================================
  
  console.log('📦 [2/3] Building backend with esbuild...');
  try {
    await build({
      entryPoints: ['server/index.ts'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/index.cjs',
      format: 'cjs',
      external: [
        'pg-native',  // Driver natif PostgreSQL (optionnel)
        'bcrypt',     // Module natif, doit être installé sur le serveur
      ],
      sourcemap: true,
      minify: process.env.NODE_ENV === 'production',
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });
    console.log('✅ Backend build complete!\n');
  } catch (error) {
    console.error('❌ Backend build failed!', error);
    process.exit(1);
  }

  // ============================================
  // ÉTAPE 3: Vérifications finales
  // ============================================
  
  console.log('📦 [3/3] Verifying build output...');
  
  const distPath = path.resolve('dist');
  const backendFile = path.join(distPath, 'index.cjs');
  const frontendDir = path.join(distPath, 'public');
  const indexHtml = path.join(frontendDir, 'index.html');
  
  const checks = [
    { path: backendFile, name: 'Backend (dist/index.cjs)' },
    { path: frontendDir, name: 'Frontend directory (dist/public/)' },
    { path: indexHtml, name: 'Frontend index.html' },
  ];
  
  let allPassed = true;
  for (const check of checks) {
    if (fs.existsSync(check.path)) {
      const stats = fs.statSync(check.path);
      const size = stats.isDirectory() ? 'directory' : `${(stats.size / 1024).toFixed(1)} KB`;
      console.log(`   ✅ ${check.name} (${size})`);
    } else {
      console.log(`   ❌ ${check.name} - NOT FOUND`);
      allPassed = false;
    }
  }

  // ============================================
  // RÉSUMÉ
  // ============================================
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  if (allPassed) {
    console.log('║           ✅ BUILD SUCCESSFUL ✅                           ║');
  } else {
    console.log('║           ⚠️ BUILD COMPLETED WITH WARNINGS ⚠️              ║');
  }
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration: ${duration}s`);
  console.log('║  Output:   dist/');
  console.log('║');
  console.log('║  To start: npm start');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
}

buildProject().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});







