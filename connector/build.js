const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.resolve(__dirname, 'dist');
const PUBLIC_SRC = path.resolve(__dirname, 'src/ui/public');
const PUBLIC_DEST = path.resolve(DIST_DIR, 'public');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyRecursiveSync(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function bundle() {
  console.log('[Build] 1/3 Ensuring dist/ directory...');
  ensureDir(DIST_DIR);

  console.log('[Build] 2/3 Copying static UI assets...');
  if (fs.existsSync(PUBLIC_SRC)) {
    copyRecursiveSync(PUBLIC_SRC, PUBLIC_DEST);
  }

  console.log('[Build] 3/3 Bundling with esbuild...');
  try {
    const esbuild = require('esbuild');
    await esbuild.build({
      entryPoints: [path.resolve(__dirname, 'src/index.js')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: path.resolve(DIST_DIR, 'bundle.js'),
      external: [
        // Externalize native or optional packages if needed
      ],
      sourcemap: false,
      minify: false
    });
    console.log('[Build] Bundle generated at dist/bundle.js');
  } catch (err) {
    console.error('[Build] Bundling failed:', err.message);
    process.exit(1);
  }
}

async function packageExe() {
  await bundle();

  console.log('[Build] Packaging into Windows Standalone Executable with pkg...');
  try {
    const pkgCmd = `npx @yao-pkg/pkg "${path.resolve(DIST_DIR, 'bundle.js')}" --targets node20-win-x64 --output "${path.resolve(DIST_DIR, 'tally-connector.exe')}" --public`;
    console.log(`[Build] Running: ${pkgCmd}`);
    execSync(pkgCmd, { stdio: 'inherit', cwd: __dirname });

    const exePath = path.resolve(DIST_DIR, 'tally-connector.exe');
    if (fs.existsSync(exePath)) {
      const stats = fs.statSync(exePath);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`\n SUCCESS! Generated Windows Executable:`);
      console.log(` Path: ${exePath}`);
      console.log(` Size: ${sizeMb} MB`);
    }
  } catch (err) {
    console.error('[Build] Packaging failed:', err.message);
    process.exit(1);
  }
}

const action = process.argv[2] || 'package';
if (action === 'bundle') {
  bundle();
} else if (action === 'package') {
  packageExe();
} else {
  console.log(`Unknown action: ${action}. Use 'bundle' or 'package'`);
}
