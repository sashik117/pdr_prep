const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const candidates =
  process.platform === "win32"
    ? [
        path.join(root, "backend", "venv311", "Scripts", "python.exe"),
        path.join(root, "backend", "venv", "Scripts", "python.exe"),
        path.join(root, "backend", ".venv", "Scripts", "python.exe"),
        "python",
        "py",
      ]
    : [
        path.join(root, "backend", "venv311", "bin", "python"),
        path.join(root, "backend", "venv", "bin", "python"),
        path.join(root, "backend", ".venv", "bin", "python"),
        "python3",
        "python",
      ];

const python = candidates.find((candidate) => candidate.includes(path.sep) ? fs.existsSync(candidate) : true);
const args = process.argv.slice(2);

if (!args.length) {
  console.error("Usage: node scripts/run-backend-python.cjs <python args...>");
  process.exit(2);
}

const result = spawnSync(python, args, {
  cwd: root,
  env: {
    ...process.env,
    PYTHONPATH: [root, path.join(root, "backend"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  },
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
