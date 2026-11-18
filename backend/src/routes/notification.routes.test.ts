import request from 'supertest';
import { app } from '../app';
import { Notification } from '../models/notification.model';
import { Project, type ProjectDocument } from '../models/project.model';
import type { UserDocument } from '../models/user.model';
import { sendNotificationEmail } from '../services/email.service';
import { notify } from '../services/notification.service';
import { bearerToken, createUser } from '../tests/factories';
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/test-db';

jest.mock('../services/email.service', () => ({
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const emailMock = jest.mocked(sendNotificationEmail);

let client: UserDocument;
let pm: UserDocument;
let developer: UserDocument;
let project: ProjectDocument;

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
  emailMock.mockClear();
});

beforeEach(async () => {
  client = await createUser({ email: 'client@example.com', role: 'client', name: 'Client Owner' });
  pm = await createUser({ email: 'pm@example.com', role: 'pm', name: 'Project Manager' });
  developer = await createUser({
    email: 'developer@example.com',
    role: 'developer',
    name: 'Developer One',
  });

  project = await Project.create({
    title: 'Notification project',
    description: 'A project used to verify notifications.',
    client: client._id,
    members: [
      { user: client._id, role: 'client' },
      { user: pm._id, role: 'pm' },
      { user: developer._id, role: 'developer' },
    ],
  });
});

describe('task assignment notifications', () => {
  it('creates an in-app notification and email for the assignee', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', auth(pm))
      .send({
        title: 'Notification enabled task',
        description: '',
        requirementId: null,
        assigneeId: developer.id,
      });

    expect(response.status).toBe(201);

    const notifications = await Notification.find({ user: developer._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('task_assigned');
    expect(notifications[0].link).toBe(`/projects/${project.id}/tasks`);
    expect(emailMock).toHaveBeenCalledTimes(1);
    expect(emailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: developer.email }),
    );
  });
});

describe('/api/notifications', () => {
  it('lists, counts, and marks notifications as read for the owner only', async () => {
    await notify([client.id, developer.id], {
      projectId: project.id,
      type: 'project_status_changed',
      message: 'Project status changed to active.',
      link: `/projects/${project.id}`,
    });

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', auth(client));

    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.data[0].message).toBe('Project status changed to active.');

    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', auth(client));

    expect(count.status).toBe(200);
    expect(count.body.data.count).toBe(1);

    const notificationId = list.body.data.data[0].id as string;
    const read = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', auth(client));

    expect(read.status).toBe(200);
    expect(read.body.data.notification.isRead).toBe(true);

    const pmList = await request(app)
      .get('/api/notifications')
      .set('Authorization', auth(pm));

    expect(pmList.status).toBe(200);
    expect(pmList.body.data.total).toBe(0);

    await notify([client.id], {
      projectId: project.id,
      type: 'issue_status_changed',
      message: 'An issue was resolved.',
      link: `/projects/${project.id}/issues`,
    });

    const readAll = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', auth(client));

    expect(readAll.status).toBe(200);
    expect(readAll.body.data.updated).toBe(1);
  });
});

describe('notification preferences', () => {
  it('creates an in-app notification but skips email when disabled', async () => {
    const quietUser = await createUser({
      email: 'quiet@example.com',
      role: 'developer',
      name: 'Quiet Developer',
      notificationPrefs: { emailOnAssignment: false },
    });

    await notify([quietUser.id], {
      projectId: project.id,
      type: 'task_assigned',
      message: 'Quiet assignment.',
      link: `/projects/${project.id}/tasks`,
    });

    expect(await Notification.countDocuments({ user: quietUser._id })).toBe(1);
    expect(emailMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/auth/profile', () => {
  it('updates the name and notification preferences', async () => {
    const response = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', auth(developer))
      .send({
        name: 'Developer Updated',
        notificationPrefs: { emailOnReminder: false },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.name).toBe('Developer Updated');
    expect(response.body.data.user.notificationPrefs.emailOnReminder).toBe(false);
    expect(response.body.data.user.notificationPrefs.emailOnAssignment).toBe(true);
  });
});
