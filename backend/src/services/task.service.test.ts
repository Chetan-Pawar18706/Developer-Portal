import { Types } from 'mongoose';
import { Project, type ProjectDocument } from '../models/project.model';
import { Task, type TaskDocument } from '../models/task.model';
import type { UserDocument } from '../models/user.model';
import type { CreateTaskInput, ListAllTasksQuery } from '../routes/task.schemas';
import { createUser } from '../tests/factories';
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/test-db';
import { ApiError } from '../utils/ApiError';
import {
  createTask,
  listAllTasks,
  moveTask,
  reviewTaskAsClient,
  updateTask,
} from './task.service';

let client: UserDocument;
let pm: UserDocument;
let developer: UserDocument;
let otherDeveloper: UserDocument;
let project: ProjectDocument;

function taskInput(
  title: string,
  overrides: Partial<CreateTaskInput> = {},
): CreateTaskInput {
  return {
    title,
    description: '',
    requirementId: null,
    assigneeId: null,
    priority: 'medium',
    estimateHours: 0,
    dueDate: null,
    labels: [],
    subtasks: [],
    ...overrides,
  };
}

function allTasksQuery(
  overrides: Partial<ListAllTasksQuery> = {},
): ListAllTasksQuery {
  return {
    page: 1,
    limit: 50,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...overrides,
  };
}

async function loadTask(taskId: string): Promise<TaskDocument> {
  const task = await Task.findById(taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return task;
}

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

afterEach(async () => {
  await clearTestDatabase();
});

beforeEach(async () => {
  client = await createUser({ email: 'client@example.com', role: 'client' });
  pm = await createUser({ email: 'pm@example.com', role: 'pm', name: 'Project Manager' });
  developer = await createUser({
    email: 'developer@example.com',
    role: 'developer',
    name: 'Developer One',
  });
  otherDeveloper = await createUser({
    email: 'developer-two@example.com',
    role: 'developer',
    name: 'Developer Two',
  });

  project = await Project.create({
    title: 'Task ordering project',
    description: 'A project used to verify task ordering and permissions.',
    client: client._id,
    members: [
      { user: client._id, role: 'client' },
      { user: pm._id, role: 'pm' },
      { user: developer._id, role: 'developer' },
      { user: otherDeveloper._id, role: 'developer' },
    ],
  });
});

describe('task ordering', () => {
  it('reorders siblings when a task moves within its status', async () => {
    const first = await createTask(project, { id: pm.id, role: 'pm' }, taskInput('First'));
    const second = await createTask(project, { id: pm.id, role: 'pm' }, taskInput('Second'));
    const third = await createTask(project, { id: pm.id, role: 'pm' }, taskInput('Third'));

    await moveTask(await loadTask(third.id), project, { id: pm.id, role: 'pm' }, {
      status: 'todo',
      order: 0,
    });

    const ordered = await Task.find({ project: project._id, status: 'todo' }).sort({
      order: 1,
    });

    expect(ordered.map((task) => task.title)).toEqual(['Third', 'First', 'Second']);
    expect(ordered.map((task) => task.order)).toEqual([0, 1, 2]);
    expect((await loadTask(first.id)).order).toBe(1);
    expect((await loadTask(second.id)).order).toBe(2);
  });

  it('re-indexes both source and target columns when a task changes status', async () => {
    const first = await createTask(project, { id: pm.id, role: 'pm' }, taskInput('First'));
    const second = await createTask(project, { id: pm.id, role: 'pm' }, taskInput('Second'));
    const third = await createTask(project, { id: pm.id, role: 'pm' }, taskInput('Third'));

    await moveTask(await loadTask(first.id), project, { id: pm.id, role: 'pm' }, {
      status: 'in_progress',
      order: 0,
    });

    await moveTask(await loadTask(third.id), project, { id: pm.id, role: 'pm' }, {
      status: 'in_progress',
      order: 0,
    });

    const todo = await Task.find({ project: project._id, status: 'todo' }).sort({
      order: 1,
    });
    const inProgress = await Task.find({
      project: project._id,
      status: 'in_progress',
    }).sort({ order: 1 });

    expect(todo.map((task) => task.title)).toEqual(['Second']);
    expect(todo.map((task) => task.order)).toEqual([0]);
    expect(inProgress.map((task) => task.title)).toEqual(['Third', 'First']);
    expect(inProgress.map((task) => task.order)).toEqual([0, 1]);
    expect((await loadTask(second.id)).order).toBe(0);
  });
});

describe('task permissions', () => {
  it('lets a developer update and move only their assigned task', async () => {
    const assigned = await createTask(
      project,
      { id: pm.id, role: 'pm' },
      taskInput('Assigned task', { assigneeId: developer.id }),
    );

    const updated = await updateTask(
      await loadTask(assigned.id),
      project,
      { id: developer.id, role: 'developer' },
      { title: 'Assigned task updated' },
    );

    expect(updated.title).toBe('Assigned task updated');

    await expect(
      updateTask(
        await loadTask(assigned.id),
        project,
        { id: otherDeveloper.id, role: 'developer' },
        { title: 'Not allowed' },
      ),
    ).rejects.toThrow(ApiError);

    await expect(
      moveTask(
        await loadTask(assigned.id),
        project,
        { id: otherDeveloper.id, role: 'developer' },
        { status: 'done', order: 0 },
      ),
    ).rejects.toThrow(ApiError);
  });

  it('records a client review and moves the task to the matching column', async () => {
    const task = await createTask(project, { id: pm.id, role: 'pm' }, taskInput('Review me'));

    await moveTask(await loadTask(task.id), project, { id: pm.id, role: 'pm' }, {
      status: 'in_review',
      order: 0,
    });

    const approved = await reviewTaskAsClient(
      await loadTask(task.id),
      project,
      { id: client.id, role: 'client' },
      { status: 'approved', note: 'Delivered as requested' },
    );

    expect(approved.status).toBe('done');
    expect(approved.clientReview.status).toBe('approved');
    expect(approved.clientReview.by?.id).toBe(client.id);

    const returnedTask = await createTask(
      project,
      { id: pm.id, role: 'pm' },
      taskInput('Needs changes'),
    );

    await moveTask(await loadTask(returnedTask.id), project, { id: pm.id, role: 'pm' }, {
      status: 'in_review',
      order: 0,
    });

    const changesRequested = await reviewTaskAsClient(
      await loadTask(returnedTask.id),
      project,
      { id: client.id, role: 'client' },
      { status: 'changes_requested', note: 'Please add the missing empty state' },
    );

    expect(changesRequested.status).toBe('in_progress');
    expect(changesRequested.clientReview.status).toBe('changes_requested');
  });
});

describe('global task listing', () => {
  it('returns only tasks from projects visible to the actor', async () => {
    await createTask(project, { id: pm.id, role: 'pm' }, taskInput('Visible task'));
    const outsider = await createUser({ email: 'outsider@example.com', role: 'client' });

    const clientResult = await listAllTasks(
      { id: client.id, role: 'client' },
      allTasksQuery(),
    );
    expect(clientResult.total).toBe(1);
    expect(clientResult.data[0]?.title).toBe('Visible task');

    const pmResult = await listAllTasks({ id: pm.id, role: 'pm' }, allTasksQuery());
    expect(pmResult.total).toBe(1);

    const outsiderResult = await listAllTasks(
      { id: outsider.id, role: 'client' },
      allTasksQuery(),
    );
    expect(outsiderResult.total).toBe(0);
    expect(outsiderResult.data).toEqual([]);
  });

  it('honours the project filter within visible projects', async () => {
    await createTask(project, { id: pm.id, role: 'pm' }, taskInput('Filtered project task'));

    const result = await listAllTasks(
      { id: client.id, role: 'client' },
      allTasksQuery({ projectId: project.id }),
    );
    expect(result.total).toBe(1);
    expect(result.data[0]?.projectId).toBe(project.id);

    const missingProject = new Types.ObjectId().toString();
    await expect(
      listAllTasks(
        { id: client.id, role: 'client' },
        allTasksQuery({ projectId: missingProject }),
      ),
    ).rejects.toThrow(ApiError);
  });
});
