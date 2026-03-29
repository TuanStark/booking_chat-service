export interface CursorPaginationResult<T> {
  data: T[];
  pagination: { hasMore: boolean; nextCursor: string | null; limit: number };
}

/** Build cursor-paginated response. Query should fetch limit+1 to detect hasMore. */
export function buildCursorPaginationResult<T extends { id: string }>(
  items: T[],
  limit: number,
): CursorPaginationResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;
  return { data, pagination: { hasMore, nextCursor, limit } };
}
