export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  totalCount: number;
}

export interface PaginatedResult<T> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: PageInfo;
}

export interface PaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export function encodeCursor(value: string | Date): string {
  const str = value instanceof Date ? value.toISOString() : value;
  return Buffer.from(str, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

export function buildPageInfo<T>(
  items: T[],
  totalCount: number,
  args: PaginationArgs,
  getCursor: (item: T) => string,
): PageInfo {
  const limit = args.first ?? args.last ?? 25;

  return {
    hasNextPage: items.length > limit,
    hasPreviousPage: !!args.after || !!args.before,
    startCursor: items.length > 0 ? getCursor(items[0]) : null,
    endCursor: items.length > 0 ? getCursor(items[Math.min(items.length - 1, limit - 1)]) : null,
    totalCount,
  };
}

export function paginationToPrisma(args: PaginationArgs): {
  take: number;
  skip: number;
  cursor?: { id: string };
} {
  const limit = args.first ?? args.last ?? 25;

  if (args.after) {
    const id = decodeCursor(args.after);
    return { take: limit + 1, skip: 1, cursor: { id } };
  }

  if (args.before) {
    const id = decodeCursor(args.before);
    return { take: -(limit + 1), skip: 1, cursor: { id } };
  }

  return { take: limit + 1, skip: 0 };
}

export function buildPaginatedResult<T extends { id: string }>(
  items: T[],
  totalCount: number,
  args: PaginationArgs,
): PaginatedResult<T> {
  const limit = args.first ?? args.last ?? 25;
  const hasMore = items.length > limit;
  const trimmed = hasMore ? items.slice(0, limit) : items;

  const edges = trimmed.map((item) => ({
    node: item,
    cursor: encodeCursor(item.id),
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage: hasMore,
      hasPreviousPage: !!args.after,
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      totalCount,
    },
  };
}
