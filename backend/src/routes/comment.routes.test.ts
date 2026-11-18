import request from 'supertest';
import { app } from '../app';
import { Project, type ProjectDocument } from '../models/project.model';
import { Task, type TaskDocument } from '../models/task.model';
import type { UserDocument } from '../models/user.model';
import { bearerToken, createUser } from '../tests/factories';
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/test-db';

let client: UserDocument;
let pm: UserDocument;
let developer: UserDocument;
let outsider: UserDocument;
let admin: UserDocument;
let project: ProjectDocument;
let task: TaskDocument;

const target = (): { entityType: 'task'; entityId: string } => ({
  entityType: 'task',
  entityId: task.id,
});

function auth(user: UserDocument): string {
  return bearerToken(user);
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
  client = await createUser({ email: 'client@example.com', role: 'client', name: 'Client Owner' });
  pm = await createUser({ email: 'pm@example.com', role: 'pm', name: 'Project Manager' });
  developer = await createUser({
    email: 'developer@example.com',
    role: 'developer',
    name: 'Developer One',
  });
  outsider = await createUser({
    email: 'outsider@example.com',
    role: 'client',
    name: 'Outside Client',
  });
  admin = await createUser({ email: 'admin@example.com', role: 'admin', name: 'Administrator' });

  project = await Project.create({
    title: 'Discussion project',
    description: 'A project used to verify comment visibility and permissions.',
    client: client._id,
    members: [
      { user: client._id, role: 'client' },
      { user: pm._id, role: 'pm' },
      { user: developer._id, role: 'developer' },
    ],
  });

  task = await Task.create({
    project: project._id,
    requirement: null,
    title: 'Comment target task',
    description: '',
    assignee: developer._id,
    reporter: pm._id,
    status: 'todo',
    priority: 'medium',
    estimateHours: 0,
    dueDate: null,
    labels: [],
    order: 0,
    subtasks: [],
    timeLogs: [],
    clientReview: { status: 'pending', note: '', by: null, at: null },
  });
});

describe('/api/comments visibility', () => {
  it('never returns developer internal notes or replies to clients', async () => {
    const internal = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(developer))
      .send({
        ...target(),
        text: 'Internal <script>alert(1)</script> delivery note',
        isInternal: true,
      });

    expect(internal.status).toBe(201);
    expect(internal.body.data.comment.isInternal).toBe(true);
    expect(internal.body.data.comment.text).not.toContain('<script>');

    const clientList = await request(app)
      .get('/api/comments')
      .set('Authorization', auth(client))
      .query(target());

    expect(clientList.status).toBe(200);
    expect(clientList.body.data.total).toBe(0);
    expect(clientList.body.data.data).toEqual([]);

    const staffList = await request(app)
      .get('/api/comments')
      .set('Authorization', auth(pm))
      .query(target());

    expect(staffList.status).toBe(200);
    expect(staffList.body.data.total).toBe(1);
    expect(staffList.body.data.data[0].isInternal).toBe(true);

    const publicComment = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(developer))
      .send({ ...target(), text: 'Public progress update' });

    const internalReply = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(developer))
      .send({
        ...target(),
        parent: publicComment.body.data.comment.id,
        text: 'Internal reply about the client',
        isInternal: true,
      });

    expect(internalReply.status).toBe(201);

    const clientThread = await request(app)
      .get('/api/comments')
      .set('Authorization', auth(client))
      .query(target());

    expect(clientThread.body.data.total).toBe(1);
    expect(clientThread.body.data.data[0].text).toBe('Public progress update');
    expect(clientThread.body.data.data[0].replies).toEqual([]);

    const staffThread = await request(app)
      .get('/api/comments')
      .set('Authorization', auth(pm))
      .query(target());
    const publicThread = (
      staffThread.body.data.data as Array<{ id: string; replies: Array<{ text: string }> }>
    ).find((comment) => comment.id === publicComment.body.data.comment.id);

    expect(publicThread?.replies).toHaveLength(1);
    expect(publicThread?.replies[0].text).toBe('Internal reply about the client');
  });

  it('blocks clients from internal notes and outsiders from every action', async () => {
    const clientInternal = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(client))
      .send({ ...target(), text: 'Trying to write an internal note', isInternal: true });

    expect(clientInternal.status).toBe(403);

    const outsiderList = await request(app)
      .get('/api/comments')
      .set('Authorization', auth(outsider))
      .query(target());

    expect(outsiderList.status).toBe(403);

    const outsiderPost = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(outsider))
      .send({ ...target(), text: 'Trying to comment' });

    expect(outsiderPost.status).toBe(403);
  });
});

describe('/api/comments ownership and reactions', () => {
  it('limits edits to the author, allows admin deletion, and toggles reactions', async () => {
    const created = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(developer))
      .send({ ...target(), text: 'Original note' });
    const commentId = created.body.data.comment.id as string;

    const otherEdit = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set('Authorization', auth(pm))
      .send({ text: 'Changed by someone else' });

    expect(otherEdit.status).toBe(403);

    const ownEdit = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set('Authorization', auth(developer))
      .send({ text: 'Edited note' });

    expect(ownEdit.status).toBe(200);
    expect(ownEdit.body.data.comment.text).toBe('Edited note');
    expect(ownEdit.body.data.comment.editedAt).not.toBeNull();

    const firstReaction = await request(app)
      .post(`/api/comments/${commentId}/reactions`)
      .set('Authorization', auth(client))
      .send({ emoji: '👍' });

    expect(firstReaction.status).toBe(200);
    expect(firstReaction.body.data.comment.reactions[0].users).toHaveLength(1);

    const secondReaction = await request(app)
      .post(`/api/comments/${commentId}/reactions`)
      .set('Authorization', auth(client))
      .send({ emoji: '👍' });

    expect(secondReaction.status).toBe(200);
    expect(secondReaction.body.data.comment.reactions).toEqual([]);

    const otherDelete = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', auth(pm));

    expect(otherDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', auth(admin));

    expect(adminDelete.status).toBe(200);

    const afterDelete = await request(app)
      .get('/api/comments')
      .set('Authorization', auth(pm))
      .query(target());

    expect(afterDelete.body.data.total).toBe(0);
  });
});
