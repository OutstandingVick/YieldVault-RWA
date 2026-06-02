/**
 * Jest mock for src/sorobanClient.ts.
 * Mapped via moduleNameMapper in jest.config.js so every test file that
 * exercises vault endpoints gets a deterministic fake hash rather than
 * attempting a real Stellar RPC call.
 */

class SorobanSimulationError extends Error {
  constructor(message, code = 'SIMULATION_ERROR', statusCode = 502) {
    super(message);
    this.name = 'SorobanSimulationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const submitVaultOperation = jest.fn().mockResolvedValue('mock-soroban-tx-hash-abcd1234');

const resolveContractId = jest.fn().mockReturnValue('MOCK_CONTRACT_ID');

module.exports = { submitVaultOperation, SorobanSimulationError, resolveContractId };
