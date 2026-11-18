import request from 'supertest';
import { app } from '../app';
import { Issue } from '../models/issue.model';
import { Project, type ProjectDocument } from '../models/project.model';
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
let project: ProjectDocument;

function auth(user: UserDocument): string {
  return bearerToken(user);
}

function issuePayload(): Record<string, unknown> {
  return {
    title: 'Checkout button fails',
    description: 'The checkout button does not respond when submitting an order.',
    type: 'bug',
    severity: 'critical',
    stepsToReproduce: '1. Add an item\n2. Open checkout\n3. Click place order',
  };
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

  project = await Project.create({
    title: 'Issue tracking project',
    description: 'A project used to verify issue workflow and task conversion.',
    client: client._id,
    members: [
      { user: client._id, role: 'client' },
      { user: pm._id, role: 'pm' },
      { user: developer._id, role: 'developer' },
    ],
  });
});

describe('/api/projects/:id/issues', () => {
  it('lets a client raise an issue, auto-assigns the PM, and supports filters', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(client))
      .send(issuePayload());

    expect(created.status).toBe(201);
    expect(created.body.data.issue.status).toBe('open');
    expect(created.body.data.issue.raisedBy.id).toBe(client.id);
    expect(created.body.data.issue.assignedTo.id).toBe(pm.id);
    expect(created.body.data.issue.stepsToReproduce).toContain('Open checkout');

    const list = await request(app)
      .get(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(pm))
      .query({ severity: 'critical', search: 'checkout', status: 'open' });

    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.data[0].title).toBe('Checkout button fails');

    const activity = await request(app)
      .get(`/api/projects/${project.id}/activity`)
      .set('Authorization', auth(pm));

    expect(activity.status).toBe(200);
    expect(activity.body.data.some((entry: { action: string }) => entry.action === 'issue_created')).toBe(
      true,
    );
  });

  it('blocks outsiders and stops clients from assigning issues', async () => {
    const outsiderList = await request(app)
      .get(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(outsider));

    expect(outsiderList.status).toBe(403);

    const created = await request(app)
      .post(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(client))
      .send(issuePayload());

    const assign = await request(app)
      .patch(`/api/issues/${created.body.data.issue.id}`)
      .set('Authorization', auth(client))
      .send({ assignedTo: developer.id });

    expect(assign.status).toBe(403);
  });
});

describe('/api/issues/:id/status', () => {
  it('allows clients to close and reopen their own issue, and staff to progress it', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(client))
      .send(issuePayload());
    const issueId = created.body.data.issue.id as string;

    const clientProgress = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', auth(client))
      .send({ status: 'in_progress' });

    expect(clientProgress.status).toBe(403);

    const close = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', auth(client))
      .send({ status: 'closed' });

    expect(close.status).toBe(200);
    expect(close.body.data.issue.status).toBe('closed');

    const reopen = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', auth(client))
      .send({ status: 'reopened' });

    expect(reopen.status).toBe(200);
    expect(reopen.body.data.issue.status).toBe('reopened');

    const progress = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set('Authorization', auth(developer))
      .send({ status: 'in_progress' });

    expect(progress.status).toBe(200);
    expect(progress.body.data.issue.status).toBe('in_progress');
  });
});

describe('/api/issues', () => {
  it('lists issues from projects the actor can access', async () => {
    await request(app)
      .post(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(client))
      .send(issuePayload());

    const globalList = await request(app)
      .get('/api/issues')
      .set('Authorization', auth(pm))
      .query({ search: 'checkout', projectId: project.id });

    expect(globalList.status).toBe(200);
    expect(globalList.body.data.total).toBe(1);
    expect(globalList.body.data.data[0].projectId).toBe(project.id);

    const outsiderList = await request(app)
      .get('/api/issues')
      .set('Authorization', auth(outsider));

    expect(outsiderList.status).toBe(200);
    expect(outsiderList.body.data.total).toBe(0);
  });
});

describe('issue comments', () => {
  it('resolves the issue project so the shared comment thread works', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(client))
      .send(issuePayload());
    const issueId = created.body.data.issue.id as string;

    const posted = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(client))
      .send({
        entityType: 'issue',
        entityId: issueId,
        text: 'This is still blocking our checkout flow.',
      });

    expect(posted.status).toBe(201);

    const comments = await request(app)
      .get('/api/comments')
      .set('Authorization', auth(pm))
      .query({ entityType: 'issue', entityId: issueId });

    expect(comments.status).toBe(200);
    expect(comments.body.data.total).toBe(1);
    expect(comments.body.data.data[0].text).toBe('This is still blocking our checkout flow.');
  });
});

describe('/api/issues/:id/convert-to-task', () => {
  it('links the issue and task in both directions when a PM converts it', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/issues`)
      .set('Authorization', auth(client))
      .send(issuePayload());
    const issueId = created.body.data.issue.id as string;

    const developerConvert = await request(app)
      .post(`/api/issues/${issueId}/convert-to-task`)
      .set('Authorization', auth(developer));

    expect(developerConvert.status).toBe(403);

    const converted = await request(app)
      .post(`/api/issues/${issueId}/convert-to-task`)
      .set('Authorization', auth(pm));

    expect(converted.status).toBe(201);
    expect(converted.body.data.task.linkedIssue.id).toBe(issueId);
    expect(converted.body.data.task.assignee.id).toBe(pm.id);
    expect(converted.body.data.task.status).toBe('todo');

    const storedIssue = await Issue.findById(issueId);
    expect(storedIssue?.linkedTask?.toString()).toBe(converted.body.data.task.id);
    expect(storedIssue?.status).toBe('in_progress');

    const issueDetail = await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Authorization', auth(client));

    expect(issueDetail.status).toBe(200);
    expect(issueDetail.body.data.issue.linkedTask.id).toBe(converted.body.data.task.id);

    const taskDetail = await request(app)
      .get(`/api/tasks/${converted.body.data.task.id}`)
      .set('Authorization', auth(client));

    expect(taskDetail.status).toBe(200);
    expect(taskDetail.body.data.task.linkedIssue.id).toBe(issueId);
  });
});
