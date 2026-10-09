import fs from "fs";
import path from "path";

const __dirname = path.resolve();

// Source and destination
const srcDir = path.join(__dirname, "src");
const serverDir = path.join(__dirname, "server");

// Folders to migrate
const folders = ["config", "controllers", "middleware", "models", "routes"];

function copyIfNotExists(srcFile, destFile) {
  if (!fs.existsSync(destFile)) {
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
    console.log(`✅ Copied: ${srcFile} → ${destFile}`);
  } else {
    console.log(`⚠️ Already exists: ${destFile} (skipped)`);
  }
}

folders.forEach(folder => {
  const srcPath = path.join(srcDir, folder);
  const destPath = path.join(serverDir, folder);

  if (fs.existsSync(srcPath)) {
    fs.readdirSync(srcPath).forEach(file => {
      const srcFile = path.join(srcPath, file);
      const destFile = path.join(destPath, file);
      copyIfNotExists(srcFile, destFile);
    });
  }
});

console.log("✨ Migration complete! Now clean up duplicates manually.");
