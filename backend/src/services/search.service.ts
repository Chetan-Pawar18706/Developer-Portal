import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { File, type FileAttributes } from '../models/file.model';
import { Issue, type IssueAttributes } from '../models/issue.model';
import { Project, type ProjectAttributes } from '../models/project.model';
import { Requirement, type RequirementAttributes } from '../models/requirement.model';
import { Task, type TaskAttributes } from '../models/task.model';
import type { SearchQuery } from '../routes/search.schemas';
import { buildProjectVisibilityFilter, type ProjectActor } from './project.service';

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

interface ProjectHit {
  _id: Types.ObjectId;
  title: string;
  description: string;
}

interface RequirementHit {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: string;
  project: Types.ObjectId;
}

interface TaskHit {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: string;
  project: Types.ObjectId;
}

interface IssueHit {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: string;
  project: Types.ObjectId;
}

interface FileHit {
  _id: Types.ObjectId;
  originalName: string;
  folder: string;
  project: Types.ObjectId;
}

const GROUP_DEFINITIONS: ReadonlyArray<Pick<SearchGroup, 'type' | 'label' | 'icon'>> = [
  { type: 'project', label: 'Projects', icon: 'folder_open' },
  { type: 'requirement', label: 'Requirements', icon: 'assignment' },
  { type: 'task', label: 'Tasks', icon: 'task_alt' },
  { type: 'issue', label: 'Issues', icon: 'bug_report' },
  { type: 'file', label: 'Files', icon: 'folder_shared' },
];

const TEXT_SCORE_SORT = { score: { $meta: 'textScore' } } as unknown as Record<string, 1 | -1>;

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function makeSnippet(value: string, maxLength = 160): string {
  const plain = stripMarkup(value);

  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

function projectTitle(map: Map<string, string>, projectId: Types.ObjectId): string {
  return map.get(projectId.toString()) ?? 'Project';
}

function emptyResult(query: string): SearchResult {
  return {
    query,
    total: 0,
    groups: GROUP_DEFINITIONS.map((definition) => ({ ...definition, items: [] })),
  };
}

/**
 * Searches every indexable collection but never returns an item from a project
 * outside the actor's visibility filter. Client accounts also exclude internal
 * files, matching the comment/file access rules used elsewhere in the API.
 */
export async function searchWorkspace(
  actor: ProjectActor,
  query: SearchQuery,
): Promise<SearchResult> {
  const searchText = query.q.trim();
  const projectFilter = buildProjectVisibilityFilter(actor);
  const accessibleProjects = (await Project.find(projectFilter).select('title').lean()) as unknown as ProjectHit[];

  if (accessibleProjects.length === 0) {
    return emptyResult(searchText);
  }

  const titles = new Map(
    accessibleProjects.map((project) => [project._id.toString(), project.title]),
  );
  const projectIds = accessibleProjects.map((project) => project._id);
  const scopedFilter = { project: { $in: projectIds }, $text: { $search: searchText } };
  const fileFilter: QueryFilter<FileAttributes> = { ...scopedFilter };

  if (actor.role === 'client') {
    fileFilter.isInternal = false;
  }

  const [projectHits, requirementHits, taskHits, issueHits, fileHits] = await Promise.all([
    Project.find({ ...projectFilter, $text: { $search: searchText } } as QueryFilter<ProjectAttributes>)
      .select('title description')
      .sort(TEXT_SCORE_SORT)
      .limit(query.limit)
      .lean() as unknown as Promise<ProjectHit[]>,
    Requirement.find(scopedFilter as QueryFilter<RequirementAttributes>)
      .select('title description status project')
      .sort(TEXT_SCORE_SORT)
      .limit(query.limit)
      .lean() as unknown as Promise<RequirementHit[]>,
    Task.find(scopedFilter as QueryFilter<TaskAttributes>)
      .select('title description status project')
      .sort(TEXT_SCORE_SORT)
      .limit(query.limit)
      .lean() as unknown as Promise<TaskHit[]>,
    Issue.find(scopedFilter as QueryFilter<IssueAttributes>)
      .select('title description status project')
      .sort(TEXT_SCORE_SORT)
      .limit(query.limit)
      .lean() as unknown as Promise<IssueHit[]>,
    File.find(fileFilter)
      .select('originalName folder project')
      .sort(TEXT_SCORE_SORT)
      .limit(query.limit)
      .lean() as unknown as Promise<FileHit[]>,
  ]);

  const projectItems: SearchResultItem[] = projectHits.map((hit) => ({
    id: hit._id.toString(),
    type: 'project',
    title: hit.title,
    snippet: makeSnippet(hit.description),
    projectId: hit._id.toString(),
    projectTitle: hit.title,
    href: `/projects/${hit._id.toString()}/overview`,
  }));

  const requirementItems: SearchResultItem[] = requirementHits.map((hit) => {
    const projectId = hit.project.toString();

    return {
      id: hit._id.toString(),
      type: 'requirement',
      title: hit.title,
      snippet: makeSnippet(hit.description),
      status: hit.status,
      projectId,
      projectTitle: projectTitle(titles, hit.project),
      href: `/projects/${projectId}/requirements/${hit._id.toString()}`,
    };
  });

  const taskItems: SearchResultItem[] = taskHits.map((hit) => {
    const projectId = hit.project.toString();

    return {
      id: hit._id.toString(),
      type: 'task',
      title: hit.title,
      snippet: makeSnippet(hit.description),
      status: hit.status,
      projectId,
      projectTitle: projectTitle(titles, hit.project),
      href: `/projects/${projectId}/tasks`,
    };
  });

  const issueItems: SearchResultItem[] = issueHits.map((hit) => {
    const projectId = hit.project.toString();

    return {
      id: hit._id.toString(),
      type: 'issue',
      title: hit.title,
      snippet: makeSnippet(hit.description),
      status: hit.status,
      projectId,
      projectTitle: projectTitle(titles, hit.project),
      href: `/projects/${projectId}/issues/${hit._id.toString()}`,
    };
  });

  const fileItems: SearchResultItem[] = fileHits.map((hit) => {
    const projectId = hit.project.toString();

    return {
      id: hit._id.toString(),
      type: 'file',
      title: hit.originalName,
      snippet: `Shared in ${hit.folder.replace(/_/g, ' ')}`,
      projectId,
      projectTitle: projectTitle(titles, hit.project),
      href: `/projects/${projectId}/files`,
    };
  });

  const itemsByType = new Map<SearchResultType, SearchResultItem[]>([
    ['project', projectItems],
    ['requirement', requirementItems],
    ['task', taskItems],
    ['issue', issueItems],
    ['file', fileItems],
  ]);

  const groups = GROUP_DEFINITIONS.map((definition) => ({
    ...definition,
    items: itemsByType.get(definition.type) ?? [],
  }));

  return {
    query: searchText,
    total: groups.reduce((sum, group) => sum + group.items.length, 0),
    groups,
  };
}
