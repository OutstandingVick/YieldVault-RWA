declare global {
  namespace Express {
    interface Request {
      authApiKeyHash?: string;
      authApiKeyRole?: string;
    }
  }
}

export {};
