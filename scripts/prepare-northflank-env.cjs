#!/usr/bin/env node

const crypto = require("node:crypto");

function secret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

const jwtSecret = secret(32);
const adminPassword = secret(12);

const envBlock = `NODE_ENV=production
PORT=8000
DATABASE_URL=<paste Northflank PostgreSQL connection string here>
DATABASE_SCHEMA=public
DATABASE_SSL=true
JWT_SECRET=${jwtSecret}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${adminPassword}
RUN_CONTAINER_BOOTSTRAP=false
RUN_STARTUP_MAINTENANCE=false
PAYMENT_MODE=mock
ALLOW_MOCK_PAYMENTS=true
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_TIMEOUT=8
SMTP_USER=pdr.preparation@gmail.com
SMTP_PASS=<paste Gmail app password here>
FRONTEND_URL=<paste Northflank public URL here>
BACKEND_PUBLIC_URL=<paste same Northflank public URL here>`;

console.log("");
console.log("Copy this block into Northflank runtime variables:");
console.log("");
console.log(envBlock);
console.log("");
console.log("Save these admin credentials somewhere private:");
console.log(`ADMIN_USERNAME=admin`);
console.log(`ADMIN_PASSWORD=${adminPassword}`);
console.log("");
console.log("After Northflank gives the public URL, replace FRONTEND_URL and BACKEND_PUBLIC_URL and redeploy.");
