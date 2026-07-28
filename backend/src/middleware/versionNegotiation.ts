import type { Request, Response, NextFunction } from 'express';

const SUPPORTED_VERSION = '1.0.0';

/**
 * Middleware for API version negotiation and deprecation headers.
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Version Negotiation
  const acceptVersion = req.get('Accept-Version');
  const xApiVersion = req.get('X-API-Version');
  const accept = req.get('Accept') || '';

  let requestedVersion: string | null = null;

  if (xApiVersion) {
    requestedVersion = xApiVersion.trim();
  } else if (acceptVersion) {
    requestedVersion = acceptVersion.trim();
  } else {
    const match = accept.match(/version\s*=\s*([^;]+)/i);
    if (match) {
      requestedVersion = match[1].trim();
    }
  }

  if (requestedVersion) {
    const isV1 =
      requestedVersion === '1' ||
      requestedVersion.toLowerCase() === 'v1' ||
      requestedVersion === '1.0.0' ||
      requestedVersion.startsWith('1.');

    if (!isV1) {
      res.status(406).json({
        error: 'Not Acceptable',
        status: 406,
        message: `The requested API version '${requestedVersion}' is not supported. Supported versions: ${SUPPORTED_VERSION}`,
      });
      return;
    }
  }

  // Always set supported API version headers
  res.set('X-API-Version', SUPPORTED_VERSION);
  res.set('X-API-Version-Supported', SUPPORTED_VERSION);

  // 2. Deprecation detection for legacy unversioned routes
  const path = req.path;
  const isLegacyUnversioned =
    path.startsWith('/vault') ||
    path.startsWith('/referrals') ||
    path.startsWith('/transactions') ||
    path.startsWith('/portfolio');

  const isLegacyApi = path.startsWith('/api/') && !path.startsWith('/api/v1/');

  if (isLegacyUnversioned || isLegacyApi) {
    res.set('Deprecation', 'true');
    res.set('Sunset', 'Fri, 31 Dec 2027 23:59:59 GMT');

    let successorPath = path;
    if (isLegacyApi) {
      successorPath = path.replace('/api/', '/api/v1/');
    } else if (isLegacyUnversioned) {
      successorPath = `/api/v1${path}`;
    }

    res.set('Link', `<${successorPath}>; rel="successor-version"`);
  }

  next();
}
