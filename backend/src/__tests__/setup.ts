import dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config({
  path: '.env.test',
  override: true,
});

// Set test environment
process.env.NODE_ENV = 'test';

// Set fallback mock environment variables for tests to keep /health happy
process.env.STELLAR_RPC_URL = 'http://localhost:8000';
process.env.DATABASE_URL = 'sqlite://dev.db';
process.env.DATABASE_REPLICA_URL = 'sqlite://dev.db';
