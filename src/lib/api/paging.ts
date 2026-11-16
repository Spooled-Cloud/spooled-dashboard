/**
 * Walk a list endpoint that pages with `limit` / `offset` and sends no total or `X-Has-More`
 * (`GET /workflows`, `GET /schedules`). A page shorter than `pageSize` is the last one.
 *
 * Rows are de-duplicated by id: a row created while the walk runs shifts later pages by one
 * (newest-first order), and an older backend that ignores `offset` repeats the first page.
 * A page that adds no new id ends the walk, and so does `maxPages`.
 */
export async function fetchAllPages<T>(
  fetchPage: (limit: number, offset: number) => Promise<T[]>,
  idOf: (row: T) => string,
  pageSize: number,
  maxPages: number
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const data = await fetchPage(pageSize, offset);
    const pageRows = Array.isArray(data) ? data : [];
    let added = 0;
    for (const row of pageRows) {
      const id = idOf(row);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
      added++;
    }
    if (added === 0 || pageRows.length < pageSize) break;
    offset += pageRows.length;
  }

  return rows;
}
