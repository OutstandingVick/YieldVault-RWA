import { 
  registerWebhookEndpoint, 
  deleteWebhookEndpoint, 
  restoreWebhookEndpoint, 
  listWebhookEndpoints,
  resetWebhookState
} from '../webhookDelivery';

describe('Webhook Soft Delete and Restore', () => {
  beforeEach(() => {
    resetWebhookState();
  });

  it('should soft delete a webhook endpoint', () => {
    const endpoint = registerWebhookEndpoint({ url: 'https://example.com/webhook' });
    
    const deleted = deleteWebhookEndpoint(endpoint.id, 'admin-1');
    expect(deleted).not.toBeNull();
    expect(deleted?.deletedAt).toBeDefined();
    expect(deleted?.deletedBy).toBe('admin-1');

    const list = listWebhookEndpoints();
    expect(list.find(e => e.id === endpoint.id)).toBeUndefined();

    const listWithDeleted = listWebhookEndpoints(true);
    expect(listWithDeleted.find(e => e.id === endpoint.id)).toBeDefined();
  });

  it('should restore a soft deleted webhook endpoint', () => {
    const endpoint = registerWebhookEndpoint({ url: 'https://example.com/webhook' });
    deleteWebhookEndpoint(endpoint.id, 'admin-1');
    
    const restored = restoreWebhookEndpoint(endpoint.id, 'admin-2');
    expect(restored).not.toBeNull();
    expect(restored?.deletedAt).toBeUndefined();
    expect(restored?.deletedBy).toBeUndefined();

    const list = listWebhookEndpoints();
    expect(list.find(e => e.id === endpoint.id)).toBeDefined();
  });

  it('should not allow deleting an already deleted endpoint', () => {
    const endpoint = registerWebhookEndpoint({ url: 'https://example.com/webhook' });
    deleteWebhookEndpoint(endpoint.id, 'admin-1');
    
    const deletedAgain = deleteWebhookEndpoint(endpoint.id, 'admin-2');
    expect(deletedAgain).toBeNull();
  });

  it('should not allow restoring an endpoint that is not deleted', () => {
    const endpoint = registerWebhookEndpoint({ url: 'https://example.com/webhook' });
    
    const restored = restoreWebhookEndpoint(endpoint.id, 'admin-1');
    expect(restored).toBeNull();
  });
});
