export type SearchResultType = 'project' | 'requirement' | 'task' | 'issue' | 'file';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  status?: string;
  projectId: string;
  projectTitle: string;
  href: string;
}

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  icon: string;
  items: SearchResultItem[];
}

export interface SearchResult {
  query: string;
  total: number;
  groups: SearchGroup[];
}
