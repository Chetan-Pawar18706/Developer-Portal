export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  details?: ApiErrorDetail[];
}

export interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PageQuery {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
