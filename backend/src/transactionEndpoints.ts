import { Router, Request, Response } from 'express';
import { logger } from './middleware/structuredLogging';
import { withSpan, getCurrentTraceId } from './tracing';
import { getPrismaClient } from './prismaClient';
import {
  parsePaginationQuery,
  sendPaginatedResponse,
  DEFAULT_PAGINATION_CONFIG,
  encodeCursor,
  decodeCursor,
} from './pagination';
import { parseUtcDateRange, type ParsedUtcDateRange } from './dateRange';

const router = Router();

/**
 * GET /api/v1/transactions
 * Retrieve transaction history with cursor-based pagination and filtering.
 * 
 * Query Parameters:
 * - limit: Items per page (1-100, default 20)
 * - cursor: Opaque cursor for pagination (from previous response's nextCursor)
 * - type: Filter by transaction type ('deposit' or 'withdrawal', or both if omitted)
 * - status: Filter by transaction status
 * - from: Start date (ISO 8601 or YYYY-MM-DD format)
 * - to: End date (ISO 8601 or YYYY-MM-DD format)
 * - sortBy: Field to sort by (default: 'timestamp')
 * - sortOrder: Sort direction 'asc' or 'desc' (default: 'desc')
 * 
 * Response: Paginated list of transactions with total count and no duplicate results across pages
 */
router.get('/', async (req: Request, res: Response) => {
  const traceId = getCurrentTraceId();

  return await withSpan('transactions.list', async (span) => {
    try {
      const { type, status } = req.query;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      // Validate type filter if provided
      const validTypes = ['deposit', 'withdrawal'];
      let typeFilter: string[] = [];
      if (type) {
        const typeStr = typeof type === 'string' ? type : '';
        const types = typeStr.split(',').map((t) => t.trim());
        for (const t of types) {
          if (!validTypes.includes(t)) {
            res.status(400).json({
              error: 'Bad Request',
              status: 400,
              message: `Invalid type filter. Allowed values: ${validTypes.join(', ')}`,
            });
            return;
          }
        }
        typeFilter = types;
      }

      // Parse pagination parameters
      const paginationQuery = parsePaginationQuery(req, {
        ...DEFAULT_PAGINATION_CONFIG,
        defaultSortBy: 'timestamp',
        defaultSortOrder: 'desc',
      });

      // Parse and validate date range
      let dateRange: ParsedUtcDateRange = {};
      try {
        if (from || to) {
          dateRange = parseUtcDateRange({ from, to }, { maxRangeDays: 366 });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Invalid date range';
        res.status(400).json({
          error: 'Bad Request',
          status: 400,
          message: errorMsg,
        });
        return;
      }

      span.setAttributes({
        'transaction.typeFilter': typeFilter.length > 0 ? typeFilter.join(',') : 'all',
        'transaction.statusFilter': status ? String(status) : 'all',
        'transaction.hasDateRange': !!(dateRange.start || dateRange.end),
        'pagination.limit': paginationQuery.limit,
        'pagination.hasCursor': !!paginationQuery.cursor,
      });

      const prisma = getPrismaClient();

      // Build where clause for Prisma query
      const whereClause: Record<string, any> = {};

      if (typeFilter.length > 0) {
        whereClause.type = { in: typeFilter };
      }

      if (status) {
        whereClause.status = String(status);
      }

      if (dateRange.start || dateRange.end) {
        whereClause.timestamp = {};
        if (dateRange.start) {
          whereClause.timestamp.gte = new Date(dateRange.start);
        }
        if (dateRange.end) {
          whereClause.timestamp.lte = new Date(dateRange.end);
        }
      }

      // Fetch total count for response metadata
      const total = await prisma.transaction.count({ where: whereClause });

      // Determine sort direction
      const sortOrder = paginationQuery.sortOrder === 'asc' ? 'asc' : 'desc';

      // Fetch transactions with cursor-based pagination
      let skip = 0;
      if (paginationQuery.cursor) {
        try {
          const decodedCursor = decodeCursor(paginationQuery.cursor);
          // The cursor is the transaction ID - we need to find its position
          const cursorTx = await prisma.transaction.findUnique({
            where: { id: decodedCursor },
          });

          if (!cursorTx) {
            res.status(400).json({
              error: 'Bad Request',
              status: 400,
              message: 'Invalid cursor value',
            });
            return;
          }

          // Count items before the cursor to determine skip value
          skip = await prisma.transaction.count({
            where: {
              ...whereClause,
              ...(sortOrder === 'desc'
                ? { timestamp: { gt: cursorTx.timestamp } }
                : { timestamp: { lt: cursorTx.timestamp } }),
            },
          });
        } catch (err) {
          logger.log('error', 'Error decoding cursor', {
            error: err instanceof Error ? err.message : String(err),
            traceId,
          });
          res.status(400).json({
            error: 'Bad Request',
            status: 400,
            message: 'Invalid cursor value',
          });
          return;
        }
      }

      // Fetch limit + 1 to detect if there are more results
      const limit = paginationQuery.limit || DEFAULT_PAGINATION_CONFIG.defaultLimit;
      const transactions = await prisma.transaction.findMany({
        where: whereClause,
        orderBy: {
          timestamp: sortOrder,
        },
        skip,
        take: limit + 1,
      });

      // Check if there are more results
      const hasMore = transactions.length > limit;
      const data = hasMore ? transactions.slice(0, limit) : transactions;

      // Build pagination metadata
      const pagination = {
        count: data.length,
        total,
        hasNextPage: hasMore,
        hasPrevPage: skip > 0,
        ...(hasMore && data.length > 0 ? { nextCursor: encodeCursor(data[data.length - 1].id) } : {}),
      };

      span.setAttributes({
        'transaction.count': data.length,
        'transaction.total': total,
        'pagination.hasNextPage': hasMore,
        'pagination.hasPrevPage': skip > 0,
      });

      logger.log('info', 'Transaction history retrieved', {
        count: data.length,
        total,
        traceId,
      });

      sendPaginatedResponse(res, data, pagination, 200);
    } catch (err) {
      logger.log('error', 'Error retrieving transaction history', {
        error: err instanceof Error ? err.message : String(err),
        traceId,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        status: 500,
        message: 'Failed to retrieve transaction history',
      });
    }
  });
});

export default router;
