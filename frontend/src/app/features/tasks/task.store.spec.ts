import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { PaginatedData } from '../../core/models/api.model';
import type { Task } from '../../core/models/task.model';
import { RealtimeService } from '../../core/services/realtime.service';
import { TaskService } from '../../core/services/task.service';
import { Subject, of, throwError } from 'rxjs';
import { TaskStore } from './task.store';

const PROJECT_ID = '507f1f77bcf86cd799439011';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: PROJECT_ID,
    projectTitle: 'Delivery project',
    requirement: null,
    linkedIssue: null,
    title: 'First task',
    description: 'A task used by the store tests.',
    assignee: null,
    reporter: null,
    status: 'todo',
    priority: 'medium',
    estimateHours: 1,
    loggedHours: 0,
    dueDate: null,
    labels: [],
    order: 0,
    subtasks: [],
    timeLogs: [],
    clientReview: { status: 'pending', note: '', by: null, at: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function page(data: Task[]): PaginatedData<Task> {
  return { data, total: data.length, page: 1, limit: 200 };
}

describe('TaskStore', () => {
  let store: TaskStore;
  let taskService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    addTimeLog: ReturnType<typeof vi.fn>;
    updateSubtasks: ReturnType<typeof vi.fn>;
    clientReview: ReturnType<typeof vi.fn>;
  };
  let taskCreated: Subject<Task>;
  let taskUpdated: Subject<Task>;
  let taskMoved: Subject<Task>;
  let taskDeleted: Subject<{ projectId: string; id: string }>;

  beforeEach(() => {
    taskService = {
      list: vi.fn(() => of(page([]))),
      create: vi.fn(() => of(makeTask())),
      update: vi.fn(() => of(makeTask())),
      move: vi.fn(() => of(makeTask())),
      delete: vi.fn(() => of(undefined)),
      addTimeLog: vi.fn(() => of(makeTask())),
      updateSubtasks: vi.fn(() => of(makeTask())),
      clientReview: vi.fn(() => of(makeTask())),
    };
    taskCreated = new Subject<Task>();
    taskUpdated = new Subject<Task>();
    taskMoved = new Subject<Task>();
    taskDeleted = new Subject<{ projectId: string; id: string }>();

    TestBed.configureTestingModule({
      providers: [
        { provide: TaskService, useValue: taskService },
        {
          provide: RealtimeService,
          useValue: {
            taskCreated$: taskCreated.asObservable(),
            taskUpdated$: taskUpdated.asObservable(),
            taskMoved$: taskMoved.asObservable(),
            taskDeleted$: taskDeleted.asObservable(),
          },
        },
      ],
    });

    store = TestBed.inject(TaskStore);
  });

  it('loads tasks and reports loading state', () => {
    taskService.list.mockReturnValue(of(page([makeTask()])));

    store.load(PROJECT_ID).subscribe();

    expect(store.loading()).toBe(false);
    expect(store.entities()).toHaveLength(1);
    expect(store.total()).toBe(1);
    expect(store.projectId()).toBe(PROJECT_ID);
    expect(taskService.list).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ page: 1, limit: 200, sortBy: 'order' }),
    );
  });

  it('records load errors and keeps the store usable', () => {
    taskService.list.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Boom' } })),
    );

    store.load(PROJECT_ID).subscribe({ error: () => undefined });

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Boom');
  });

  it('resets filters when the project changes', () => {
    store.load(PROJECT_ID).subscribe();
    store.setFilters({ status: 'done', search: '  login  ' });

    expect(taskService.list).toHaveBeenLastCalledWith(
      PROJECT_ID,
      expect.objectContaining({ status: 'done', search: 'login', page: 1 }),
    );

    store.load('507f1f77bcf86cd799439012').subscribe();

    expect(store.filters().status).toBe('');
    expect(store.filters().search).toBe('');
  });

  it('groups tasks by status and exposes counts', () => {
    store.entities.set([
      makeTask({ id: 'a', status: 'todo', order: 1 }),
      makeTask({ id: 'b', status: 'todo', order: 0 }),
      makeTask({ id: 'c', status: 'done', order: 0 }),
    ]);

    expect(store.grouped().todo.map((task) => task.id)).toEqual(['b', 'a']);
    expect(store.counts()).toEqual({
      todo: 2,
      in_progress: 0,
      in_review: 0,
      blocked: 0,
      done: 1,
    });
  });

  it('reorders optimistically on move and rolls back on failure', () => {
    const first = makeTask({ id: 'first', order: 0 });
    const second = makeTask({ id: 'second', order: 1 });
    const moveSource = new Subject<Task>();
    store.entities.set([first, second]);
    taskService.move.mockReturnValue(moveSource.asObservable());

    store.move('second', { status: 'todo', order: 0 }).subscribe({ error: () => undefined });

    expect(store.entities()[0].id).toBe('second');

    moveSource.error(new HttpErrorResponse({ status: 409, error: { message: 'Conflict' } }));

    expect(store.entities()[0].id).toBe('first');
    expect(store.error()).toBe('Conflict');
  });

  it('applies realtime task events only for the active project', () => {
    store.projectId.set(PROJECT_ID);
    const remote = makeTask({ id: 'remote' });

    taskCreated.next(remote);
    expect(store.entities()).toEqual([remote]);

    taskUpdated.next({ ...remote, title: 'Renamed remotely' });
    expect(store.entities()[0].title).toBe('Renamed remotely');

    taskDeleted.next({ projectId: PROJECT_ID, id: remote.id });
    expect(store.entities()).toEqual([]);

    taskCreated.next(makeTask({ id: 'foreign', projectId: 'other-project' }));
    expect(store.entities()).toEqual([]);
  });

  it('tracks saving state for create and delete operations', () => {
    const created: Task[] = [];

    store.create(PROJECT_ID, {
      title: 'New task',
      description: '',
      priority: 'medium',
      estimateHours: 0,
      labels: [],
      subtasks: [],
    }).subscribe((task) => created.push(task));

    expect(store.saving()).toBe(false);
    expect(created).toHaveLength(1);

    store.entities.set([created[0]]);
    store.remove(created[0].id).subscribe();

    expect(store.saving()).toBe(false);
    expect(store.entities()).toEqual([]);
  });
});
