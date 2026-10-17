export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  page: number;
  limit: number;
}

export interface PaginationMeta extends PageRequest {
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  pagination: PaginationMeta;
}

export const pageSkip = ({ page, limit }: PageRequest): number => (page - 1) * limit;

export const toPage = <T>(items: T[], total: number, { page, limit }: PageRequest): Page<T> => ({
  items,
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
});
