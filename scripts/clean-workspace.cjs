const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const removablePaths = [
  ".pytest_cache",
  "frontend/dist",
  "docs/screenshots/audit",
];

const keepFiles = new Map([
  ["docs/screenshots/audit", [".gitkeep"]],
]);

function isInsideRoot(target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function removePath(relativePath) {
  const target = path.resolve(root, relativePath);
  if (!isInsideRoot(target) || !fs.existsSync(target)) {
    return 0;
  }

  const keep = keepFiles.get(relativePath);
  if (keep) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    for (const file of keep) {
      fs.writeFileSync(path.join(target, file), "\n");
    }
  } else {
    fs.rmSync(target, { recursive: true, force: true });
  }

  return 1;
}

function removePycache(dir) {
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (!isInsideRoot(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (entry.name === "__pycache__") {
        fs.rmSync(fullPath, { recursive: true, force: true });
        removed += 1;
      } else if (!["node_modules", ".git"].includes(entry.name)) {
        removed += removePycache(fullPath);
      }
    }
  }
  return removed;
}

function cleanLogs() {
  const logsDir = path.resolve(root, "backend/logs");
  if (!fs.existsSync(logsDir)) {
    return 0;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(logsDir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === ".gitkeep") {
      continue;
    }
    fs.rmSync(path.join(logsDir, entry.name), { force: true });
    removed += 1;
  }
  return removed;
}

let removedTopLevel = 0;
for (const relativePath of removablePaths) {
  removedTopLevel += removePath(relativePath);
}

const removedPycache = removePycache(root);
const removedLogs = cleanLogs();

console.log(
  `Workspace cleaned: ${removedTopLevel} target folders, ${removedPycache} __pycache__ folders, ${removedLogs} log files.`
);
console.log("Kept: backend/uploads, node_modules, virtual environments, source code and media seeds.");
