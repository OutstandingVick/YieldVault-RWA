import request from 'supertest';
import app from '../index';
import { tokenStore, InMemoryRefreshTokenStore, RedisRefreshTokenStore } from '../auth';

describe('Auth & Session Management - Issue #436', () => {
  // 1. Verify store fallback logic
  it('should correctly select the token store based on REDIS_URL presence', () => {
    if (process.env.REDIS_URL) {
      expect(tokenStore).toBeInstanceOf(RedisRefreshTokenStore);
    } else {
      expect(tokenStore).toBeInstanceOf(InMemoryRefreshTokenStore);
    }
  });

  // 2. Full Session Lifecycle and Replay Attack / Theft Detection
  describe('JWT Rotation & Replay Theft Detection', () => {
    let originalRefreshToken: string;
    let rotatedRefreshToken: string;

    it('should successfully bootstrap a session via /login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ userId: 'user-12345' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      originalRefreshToken = response.body.refreshToken;
    });

    it('should rotate and refresh successfully on first use', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: originalRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(originalRefreshToken);

      rotatedRefreshToken = response.body.refreshToken;
    });

    it('should detect a replay attack and invalidate the full family if originalRefreshToken is reused', async () => {
      // Re-use originalRefreshToken (already used)
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: originalRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toContain('token reuse detected');

      // Now verify that the rotated token is ALSO invalidated (entire family revoked)
      const rotatedResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotatedRefreshToken });

      expect(rotatedResponse.status).toBe(401);
    });

    it('should return 401 when trying to refresh with a non-existent or invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'non-existent-token-abc-123' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should successfully revoke a session family on demand', async () => {
      // Create new session
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ userId: 'user-revocable' });

      const newRefToken = loginResponse.body.refreshToken;

      // Revoke it
      const revokeResponse = await request(app)
        .post('/api/v1/auth/revoke')
        .send({ refreshToken: newRefToken });

      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body).toHaveProperty('message', 'Session family successfully revoked');

      // Refreshing should now fail
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newRefToken });

      expect(refreshResponse.status).toBe(401);
    });
  });
});
