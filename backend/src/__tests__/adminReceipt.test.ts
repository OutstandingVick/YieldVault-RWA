import request from 'supertest';
import express from 'express';
import { prisma } from '../prisma';
import { generateAdminReceipt, verifyReceiptSignature } from '../adminReceipt';

// Mocking the environment for tests
process.env.ADMIN_ACTION_RECEIPT_SECRET = 'test-secret';

describe('Admin Action Receipts', () => {
  beforeEach(async () => {
    await prisma.adminActionReceipt.deleteMany();
  });

  it('should generate a signed receipt', async () => {
    const action = 'test.action';
    const actor = 'test-admin';
    const input = { foo: 'bar' };
    const resultingState = { success: true };

    const receipt = await generateAdminReceipt({
      action,
      actor,
      input,
      resultingState,
    });

    expect(receipt.id).toBeDefined();
    expect(receipt.action).toBe(action);
    expect(receipt.actor).toBe(actor);
    expect(receipt.inputHash).toBeDefined();
    expect(receipt.resultingState).toEqual(resultingState);
    expect(receipt.signature).toBeDefined();

    // Verify signature
    const isValid = verifyReceiptSignature(receipt);
    expect(isValid).toBe(true);

    // Verify persistence
    const saved = await prisma.adminActionReceipt.findUnique({
      where: { id: receipt.id },
    });
    expect(saved).toBeDefined();
    expect(saved?.action).toBe(action);
  });

  it('should fail verification if receipt is tampered with', async () => {
    const receipt = await generateAdminReceipt({
      action: 'test.action',
      actor: 'test-admin',
      input: { foo: 'bar' },
      resultingState: { success: true },
    });

    const tamperedReceipt = {
      ...receipt,
      resultingState: { success: false }, // Tamper with state
    };

    const isValid = verifyReceiptSignature(tamperedReceipt);
    expect(isValid).toBe(false);
  });
});
