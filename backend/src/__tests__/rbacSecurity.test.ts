import request from 'supertest';
import app from '../index';
import { registerApiKey } from '../middleware/apiKeyAuth';
import { Permission, resolveAdminRoutePermission } from '../middleware/rbac';

describe('Expanded RBAC Security Tests', () => {
  const viewerKey = 'viewer-sec-key';
  const operatorKey = 'operator-sec-key';
  const adminKey = 'admin-sec-key';

  beforeEach(() => {
    registerApiKey(viewerKey, { role: 'viewer' });
    registerApiKey(operatorKey, { role: 'operator' });
    registerApiKey(adminKey, { role: 'admin' });
  });

  it('maps new admin routes correctly in resolveAdminRoutePermission()', () => {
    const reqMaintenance = {
      method: 'POST',
      path: '/admin/maintenance/windows',
    } as any;
    expect(resolveAdminRoutePermission(reqMaintenance)).toBe(Permission.CONFIG_WRITE);

    const reqReplay = {
      method: 'POST',
      path: '/admin/emails/replay/123',
    } as any;
    expect(resolveAdminRoutePermission(reqReplay)).toBe(Permission.JOBS_WRITE);

    const reqImpersonateSession = {
      method: 'POST',
      path: '/admin/impersonate/sessions',
    } as any;
    expect(resolveAdminRoutePermission(reqImpersonateSession)).toBe(Permission.IMPERSONATE);
  });

  it('denies viewer keys from running maintenance window operations', async () => {
    const res = await request(app)
      .post('/admin/maintenance/windows')
      .set('Authorization', `ApiKey ${viewerKey}`)
      .send({ title: 'Test Window' });

    expect(res.status).toBe(403);
    expect(res.body.requiredPermission).toBe(Permission.CONFIG_WRITE);
  });

  it('denies operators from starting impersonation sessions', async () => {
    const res = await request(app)
      .post('/admin/impersonate/sessions')
      .set('Authorization', `ApiKey ${operatorKey}`)
      .send({ targetWallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567' });

    expect(res.status).toBe(403);
    expect(res.body.requiredPermission).toBe(Permission.IMPERSONATE);
  });
});
