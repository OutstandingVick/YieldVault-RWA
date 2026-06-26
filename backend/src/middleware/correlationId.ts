import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createRequestId, normalizeRequestId, requestIdStorage } from '../requestContext';

const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const REQUEST_ID_HEADER = 'X-Request-ID';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      requestId: string;
    }
  }
}

export type CorrelationIdRequest = Request;

export const correlationIdMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const correlationId =
    normalizeRequestId(req.get?.(CORRELATION_ID_HEADER)) || createRequestId();
  const requestId =
    normalizeRequestId(req.get?.(REQUEST_ID_HEADER)) || correlationId;

  req.correlationId = correlationId;
  req.requestId = requestId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  res.setHeader(REQUEST_ID_HEADER, requestId);

  requestIdStorage.run({ requestId, correlationId }, () => {
    next();
  });
};
