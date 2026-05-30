# Local Development Quickstart Guide

This guide provides a complete walkthrough for setting up YieldVault RWA for local development, including service dependencies, startup order, and common troubleshooting steps.

## Service Dependency Matrix

```mermaid
graph TD
    A[Node.js 18+] --> B[Backend API]
    A --> C[Frontend]
    D[PostgreSQL] --> B
    E[Redis] --> B
    F[Rust/Cargo] --> G[Smart Contracts]
    B --> H[Stellar Testnet RPC]
    C --> H
    C --> B
    G --> H
```

### Services Overview

| Service             | Purpose                 | Default Port | Status Check                        | Dependency                     |
| ------------------- | ----------------------- | ------------ | ----------------------------------- | ------------------------------ |
| **PostgreSQL**      | Data persistence        | 5432         | `psql -c "SELECT 1"`                | None (external or Docker)      |
| **Redis**           | Caching & rate limiting | 6379         | `redis-cli ping`                    | Backend                        |
| **Backend API**     | Express.js REST API     | 3000         | `curl http://localhost:3000/health` | PostgreSQL, Redis, Stellar RPC |
| **Frontend**        | React + Vite UI         | 5173         | `http://localhost:5173`             | Backend API, Stellar Testnet   |
| **Smart Contracts** | Soroban Rust contracts  | N/A          | Build succeeds                      | Cargo + wasm32 target          |
| **Stellar RPC**     | External service        | N/A          | Handled by SDK                      | None (external)                |

## Prerequisites

Before starting, ensure you have the following installed:

### Core Requirements

- **Node.js 18+** – Check with `node --version`
- **npm** or **pnpm** – Check with `npm --version` or `pnpm --version`
- **Git** – For version control
- **Rust 1.74+** – Check with `rustc --version` (needed for smart contracts)
- **Docker & Docker Compose** – For PostgreSQL and Redis (or install them separately)

### Optional Tools

- **Stellar CLI** – For contract deployments
- **Foundry** – For advanced testing (optional)
- **VS Code** – Recommended editor with Rust Analyzer extension

### System-Specific Installation

#### Windows

```powershell
# Install Node.js from https://nodejs.org (LTS recommended)
# Install Git from https://git-scm.com

# Install Rust using rustup-init.exe (included in repo):
./rustup-init.exe -y

# Add wasm32 target
rustc target add wasm32-unknown-unknown

# Install Docker Desktop from https://www.docker.com/products/docker-desktop
```

#### macOS

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@18 git rustup docker

# Install Rust
rustup-init
rustup target add wasm32-unknown-unknown

# Start Docker Desktop (from Applications folder)
```

#### Linux (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

## Local Setup Order

Follow these steps in order to ensure all dependencies are properly initialized:

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/YieldVault-RWA.git
cd YieldVault-RWA
```

### Step 2: Start Infrastructure Services

Start PostgreSQL and Redis first (they have no dependencies).

#### Using Docker Compose

```bash
# Start PostgreSQL and Redis containers
docker-compose up -d postgres redis

# Verify services are running
docker ps

# Expected output should show both 'postgres' and 'redis' containers
```

#### Or Manual Installation

If Docker is not available, install and run services separately:

```bash
# PostgreSQL
# Install from https://www.postgresql.org/download
# Run: postgres -D /usr/local/var/postgres

# Redis
# Install from https://redis.io/download
# Run: redis-server
```

**Verify PostgreSQL:**

```bash
psql -U postgres -d postgres -c "SELECT version();"
```

**Verify Redis:**

```bash
redis-cli ping
# Expected: PONG
```

### Step 3: Setup Backend

```bash
cd backend

# Copy environment template
cp .env.local.example .env.local

# Install dependencies
npm install

# Initialize database
npx prisma migrate dev

# Verify database is ready
npm run db:check-drift

# Start development server
npm run dev

# In another terminal, verify health check
curl http://localhost:3000/health
```

**Expected output from health check:**

```json
{
  "status": "healthy",
  "checks": {
    "api": "up",
    "cache": "up",
    "stellarRpc": "up"
  }
}
```

### Step 4: Setup Frontend

```bash
cd ../frontend

# Copy environment template
cp .env.local.example .env.local

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser: http://localhost:5173
```

### Step 5: Setup Smart Contracts (Optional)

Only needed if you plan to modify contracts:

```bash
cd ../contracts/vault

# Install Rust dependencies (auto on first build)
cargo build --target wasm32-unknown-unknown --release

# Run contract tests
cargo test

# View generated docs
cargo doc --open
```

## Complete Startup Sequence

Once everything is set up, here's the recommended startup order for future development sessions:

### Terminal 1: Infrastructure

```bash
docker-compose up -d postgres redis
# Wait 5-10 seconds for services to be ready
```

### Terminal 2: Backend API

```bash
cd backend
npm run dev
# Wait for "Server running on port 3000" message
```

### Terminal 3: Frontend

```bash
cd frontend
npm run dev
# Wait for "Local: http://localhost:5173" message
```

### Terminal 4: Optional - Contract Development

```bash
cd contracts/vault
cargo watch -x "test --target wasm32-unknown-unknown"
```

## Environment Configuration

### Backend Environment Variables

Create `backend/.env.local`:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (must match Docker Compose or local installation)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yieldvault_dev

# Stellar Network
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_NETWORK=testnet
VAULT_CONTRACT_ID=your_testnet_contract_id_here

# Cache
REDIS_URL=redis://localhost:6379

# API Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional - Log verbosity
LOG_LEVEL=debug
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```env
# Vite configuration
VITE_API_BASE_URL=http://localhost:3000

# Stellar Network
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Contract
VITE_VAULT_CONTRACT_ID=your_testnet_contract_id_here

# Optional - Analytics & Error Tracking
VITE_FF_DEBUG_MODE=true
```

## Health Checks

After all services are started, verify everything is working:

```bash
# Backend API health
curl http://localhost:3000/health

# Backend readiness
curl http://localhost:3000/ready

# Frontend (should see HTML)
curl -I http://localhost:5173

# Database connection
cd backend && npm run db:check-drift

# Redis connectivity
redis-cli ping
```

## Troubleshooting Guide

### PostgreSQL Connection Issues

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions:**

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running, start it:
docker-compose up -d postgres

# Verify connection string in .env.local
# Default: postgresql://postgres:postgres@localhost:5432/yieldvault_dev

# Check PostgreSQL logs
docker logs yieldvault_rwa-postgres-1

# Test connection manually
psql -U postgres -d yieldvault_dev -h localhost
```

### Redis Connection Issues

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solutions:**

```bash
# Check if Redis is running
docker ps | grep redis

# If not running, start it:
docker-compose up -d redis

# Verify connection
redis-cli ping  # Should return: PONG

# Check Redis logs
docker logs yieldvault_rwa-redis-1

# Check REDIS_URL in backend .env.local
# Default: redis://localhost:6379
```

### Database Migration Failures

**Problem:** `Error: P1000 Authentication failed` or migration errors

**Solutions:**

```bash
# Reset database (WARNING: Loses all data)
cd backend
npx prisma migrate reset --force

# Or manually drop and recreate
psql -U postgres -h localhost -c "DROP DATABASE yieldvault_dev;"
psql -U postgres -h localhost -c "CREATE DATABASE yieldvault_dev;"
npx prisma migrate deploy
```

### Backend Won't Start

**Problem:** `Port 3000 already in use` or other startup errors

**Solutions:**

```bash
# Check what's using port 3000
# On Windows:
netstat -ano | findstr :3000

# On macOS/Linux:
lsof -i :3000

# Kill the process if needed (Windows):
taskkill /PID <PID> /F

# Or use different port:
PORT=3001 npm run dev
```

### Frontend Build Issues

**Problem:** `node_modules issues` or build failures

**Solutions:**

```bash
cd frontend

# Clear node_modules and cache
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Reinstall
npm install
npm run dev
```

### Stellar RPC Connection Issues

**Problem:** `Error: Network request failed` or `Stellar RPC timeout`

**Solutions:**

```bash
# Test RPC endpoint directly
curl https://soroban-testnet.stellar.org/health

# Check your VITE_SOROBAN_RPC_URL in frontend/.env.local
# Check STELLAR_RPC_URL in backend/.env.local

# If testnet is down, try using soroban cli:
soroban network list-known

# Use a different RPC if available
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org npm run dev
```

### Docker Issues

**Problem:** `docker: command not found` or `permission denied`

**Solutions:**

```bash
# Verify Docker is installed and running
docker --version
docker ps

# On Linux, add user to docker group:
sudo usermod -aG docker $USER
newgrp docker

# Restart Docker service if needed:
# Windows: Restart Docker Desktop
# macOS: Restart Docker Desktop
# Linux: sudo systemctl restart docker
```

### Dependency Version Conflicts

**Problem:** `npm ERR! peer dep missing` or conflicting versions

**Solutions:**

```bash
# Use exact versions from lock file
rm -rf node_modules
npm ci  # Use this instead of npm install

# Update all dependencies carefully
npm audit fix

# For backend/frontend separately:
cd backend && npm ci
cd ../frontend && npm ci
```

### "Module not found" Errors

**Problem:** `Cannot find module '@stellar/stellar-sdk'` or similar

**Solutions:**

```bash
# Reinstall all dependencies
npm install

# For monorepo issues, install at project root too:
cd ../.. && npm install
cd frontend && npm install

# Clear npm cache
npm cache clean --force
npm install
```

### Contract Build Failures

**Problem:** `error: could not compile wasm artifact`

**Solutions:**

```bash
cd contracts/vault

# Check Rust version
rustc --version  # Should be 1.74 or higher

# Update Rust
rustup update

# Ensure wasm32 target is installed
rustup target add wasm32-unknown-unknown

# Clean and rebuild
cargo clean
cargo build --target wasm32-unknown-unknown --release

# Check for compile errors
cargo check
```

## Development Workflow

### Running Tests

```bash
# Backend unit tests
cd backend
npm run test

# Frontend unit tests
cd ../frontend
npm run test

# E2E tests
npm run test:e2e

# Contract tests
cd ../contracts/vault
cargo test
```

### Code Quality

```bash
# Lint all code
cd backend && npm run lint
cd ../frontend && npm run lint

# Format code
cd backend && npm run format
cd ../frontend && npm run format

# Security audit
cd backend && npm audit
cd ../frontend && npm audit
```

### Database Changes

```bash
# Create new migration
cd backend
npx prisma migrate dev --name <migration_name>

# Generate Prisma client after schema changes
npx prisma generate

# View database in Prisma Studio
npx prisma studio
```

## Performance Optimization

### Local Development Tips

1. **Use `npm ci` instead of `npm install`** – Faster and more reproducible
2. **Keep docker containers running** – Don't stop/start them repeatedly
3. **Enable source maps for debugging** – Already enabled in dev config
4. **Use VS Code extensions** – Prettier, ESLint, Rust Analyzer for better DX
5. **Monitor ports** – Keep HTTP/2 enabled for Vite for faster reload

### Memory Management

If experiencing memory issues:

```bash
# Backend with more memory
NODE_OPTIONS="--max-old-space-size=4096" npm run dev

# Frontend with more memory
NODE_OPTIONS="--max-old-space-size=2048" npm run dev
```

## Common Development Tasks

### Accessing Swagger API Docs

```bash
# Docs available at:
# http://localhost:3000/api-docs
```

### Viewing Database

```bash
# Open Prisma Studio
cd backend
npx prisma studio

# Opens http://localhost:5555 with database browser
```

### Testing Webhook Events

```bash
# Backend includes test endpoints:
# POST http://localhost:3000/admin/test-webhook
```

### Debugging with VS Code

1. Install **Debugger for Chrome** extension
2. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/backend/src/index.ts",
      "preLaunchTask": "npm: dev"
    }
  ]
}
```

## Additional Resources

- **Architecture Overview** – See [docs/CONTRACTS_ARCHITECTURE.md](./CONTRACTS_ARCHITECTURE.md)
- **Environment Setup** – See [ENVIRONMENT_SETUP_GUIDE.md](../ENVIRONMENT_SETUP_GUIDE.md)
- **API Documentation** – See [docs/api/README.md](./api/README.md)
- **Contributing Guide** – See [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Stellar Documentation** – https://developers.stellar.org/
- **Soroban Documentation** – https://developers.stellar.org/docs/build/smart-contracts

## Getting Help

- **Check logs** – Always the first troubleshooting step
- **Search issues** – Check GitHub issues for similar problems
- **Review documentation** – Most common issues are covered above
- **Ask in discussions** – Create a new discussion for help

---

**Last Updated:** May 2026  
**Maintained by:** Development Team  
**Version:** 1.0.0
