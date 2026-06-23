declare module 'dotenv' {
  const dotenv: {
    config: (options?: Record<string, unknown>) => { parsed?: Record<string, string> };
  };
  export default dotenv;
}

declare module 'express-rate-limit' {
  import { RequestHandler } from 'express';

  export interface Options {
    [key: string]: unknown;
  }

  export type RateLimitRequestHandler = RequestHandler;

  const rateLimit: (options?: Partial<Options>) => RateLimitRequestHandler;
  export default rateLimit;
}

declare module 'rate-limit-redis' {
  class RedisStore {
    constructor(options?: Record<string, unknown>);
  }
  export default RedisStore;
}

declare module 'decimal.js' {
  class Decimal {
    constructor(value: number | string | Decimal);
    toNumber(): number;
    toString(): string;
    plus(value: number | string | Decimal): Decimal;
    minus(value: number | string | Decimal): Decimal;
    mul(value: number | string | Decimal): Decimal;
    div(value: number | string | Decimal): Decimal;
    toFixed(decimalPlaces?: number): string;
  }
  export default Decimal;
}

declare module 'node-cache' {
  interface NodeCacheOptions {
    stdTTL?: number;
    checkperiod?: number;
  }

  class NodeCache {
    constructor(options?: NodeCacheOptions);
    get<T = unknown>(key: string): T | undefined;
    set<T = unknown>(key: string, value: T, ttl?: number): boolean;
    del(key: string | string[]): number;
    flushAll(): void;
  }

  export default NodeCache;
}
