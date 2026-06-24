import { Router, Request, Response } from 'express';
import { walletAliasMappingService } from './walletAliasService';
import { validate, WalletAliasLinkSchema, WalletAliasResolveQuerySchema } from './middleware/validate';
import { readsLimiter } from './rateLimiter';

const router = Router();

/**
 * POST /api/v1/wallet-aliases/link
 * Links wallet identifiers from different providers to a single canonical identity.
 */
router.post(
  '/link',
  readsLimiter,
  validate({ body: WalletAliasLinkSchema }),
  (req: Request, res: Response) => {
    const { primaryAlias, primarySource, linkedAlias, linkedSource } = req.body as {
      primaryAlias: string;
      primarySource: string;
      linkedAlias: string;
      linkedSource: string;
    };

    try {
      const mapping = walletAliasMappingService.linkProviderIdentity(
        primaryAlias,
        primarySource,
        linkedAlias,
        linkedSource,
      );

      res.status(200).json({
        canonicalId: mapping.canonicalId,
        aliases: mapping.aliases,
        sources: mapping.sources,
        canonicalWallet: walletAliasMappingService.resolveCanonicalWallet(
          linkedAlias,
          linkedSource,
        ),
      });
    } catch (err) {
      res.status(400).json({
        error: 'Bad Request',
        status: 400,
        message: err instanceof Error ? err.message : 'Failed to link wallet aliases',
      });
    }
  },
);

/**
 * GET /api/v1/wallet-aliases/resolve
 * Resolves a provider-specific alias to its canonical identity linkage.
 */
router.get(
  '/resolve',
  readsLimiter,
  validate({ query: WalletAliasResolveQuerySchema }),
  (req: Request, res: Response) => {
    const { alias, source } = req.query as { alias: string; source: string };
    const mapping = walletAliasMappingService.resolveAlias(alias, source);

    if (!mapping) {
      res.status(404).json({
        error: 'Not Found',
        status: 404,
        message: 'No identity linkage found for the provided alias',
      });
      return;
    }

    res.status(200).json({
      ...mapping,
      canonicalWallet: walletAliasMappingService.resolveCanonicalWallet(alias, source),
    });
  },
);

/**
 * GET /api/v1/wallet-aliases/:canonicalId
 * Returns all aliases linked to a canonical identity.
 */
router.get('/:canonicalId', readsLimiter, (req: Request, res: Response) => {
  const mapping = walletAliasMappingService.getIdentityLinks(req.params.canonicalId);

  if (!mapping) {
    res.status(404).json({
      error: 'Not Found',
      status: 404,
      message: 'Canonical identity not found',
    });
    return;
  }

  res.status(200).json(mapping);
});

export default router;
