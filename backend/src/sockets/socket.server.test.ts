import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Socket } from 'socket.io-client';
import { io as connectClient } from 'socket.io-client';
import { app } from '../app';
import { Project, type ProjectDocument } from '../models/project.model';
import type { UserDocument } from '../models/user.model';
import { createUser } from '../tests/factories';
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/test-db';
import { signAccessToken } from '../utils/token';
import {
  closeSocketServer,
  emitProjectEvent,
  initSocketServer,
  REALTIME_EVENTS,
} from './socket.server';

let server: HttpServer;
let url: string;
let client: UserDocument;
let pm: UserDocument;
let outsider: UserDocument;
let project: ProjectDocument;
const sockets: Socket[] = [];

function socketFor(user: UserDocument): Socket {
  const socket = connectClient(url, {
    auth: { token: signAccessToken(user.id, user.role) },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  sockets.push(socket);
  return socket;
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function handler(payload: T): void {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, handler);
  });
}

async function expectNoEvent(socket: Socket, event: string, waitMs = 300): Promise<void> {
  let received = false;
  const handler = (): void => {
    received = true;
  };

  socket.on(event, handler);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  socket.off(event, handler);

  expect(received).toBe(false);
}

async function waitForConnection(socket: Socket): Promise<void> {
  if (socket.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket did not connect')), 2000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  client = await createUser({ email: 'realtime-client@example.com', role: 'client' });
  pm = await createUser({
    email: 'realtime-pm@example.com',
    role: 'pm',
    name: 'Realtime PM',
  });
  outsider = await createUser({
    email: 'realtime-outsider@example.com',
    role: 'client',
  });

  project = await Project.create({
    title: 'Realtime isolation project',
    description: 'A project used to verify socket room isolation.',
    client: client._id,
    members: [
      { user: client._id, role: 'client' },
      { user: pm._id, role: 'pm' },
    ],
  });

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  await initSocketServer(server);
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const socket of sockets) {
    socket.disconnect();
  }
  sockets.length = 0;

  await closeSocketServer();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await clearTestDatabase();
});

describe('socket rooms', () => {
  it('delivers public project events only to project members', async () => {
    const clientSocket = socketFor(client);
    const pmSocket = socketFor(pm);
    const outsiderSocket = socketFor(outsider);
    await Promise.all([waitForConnection(clientSocket), waitForConnection(pmSocket), waitForConnection(outsiderSocket)]);

    const clientEvent = waitForEvent<{ id: string }>(clientSocket, REALTIME_EVENTS.COMMENT_CREATED);
    const pmEvent = waitForEvent<{ id: string }>(pmSocket, REALTIME_EVENTS.COMMENT_CREATED);
    const outsiderEvent = expectNoEvent(outsiderSocket, REALTIME_EVENTS.COMMENT_CREATED);

    emitProjectEvent(project.id, REALTIME_EVENTS.COMMENT_CREATED, { id: 'public-comment' });

    await expect(clientEvent).resolves.toMatchObject({ id: 'public-comment' });
    await expect(pmEvent).resolves.toMatchObject({ id: 'public-comment' });
    await outsiderEvent;
  });

  it('delivers internal project events only to the staff room', async () => {
    const clientSocket = socketFor(client);
    const pmSocket = socketFor(pm);
    await Promise.all([waitForConnection(clientSocket), waitForConnection(pmSocket)]);

    const clientEvent = expectNoEvent(clientSocket, REALTIME_EVENTS.COMMENT_CREATED);
    const pmEvent = waitForEvent<{ id: string }>(pmSocket, REALTIME_EVENTS.COMMENT_CREATED);

    emitProjectEvent(
      project.id,
      REALTIME_EVENTS.COMMENT_CREATED,
      { id: 'internal-comment', isInternal: true },
      true,
    );

    await expect(pmEvent).resolves.toMatchObject({ id: 'internal-comment' });
    await clientEvent;
  });

  it('keeps internal typing indicators inside the staff room', async () => {
    const clientSocket = socketFor(client);
    const pmSocket = socketFor(pm);
    await Promise.all([waitForConnection(clientSocket), waitForConnection(pmSocket)]);

    const clientEvent = expectNoEvent(clientSocket, REALTIME_EVENTS.TYPING);
    const pmEvent = waitForEvent<{ isInternal: boolean }>(pmSocket, REALTIME_EVENTS.TYPING);

    pmSocket.emit('typing', {
      projectId: project.id,
      entityType: 'task',
      entityId: 'task-1',
      isInternal: true,
      isTyping: true,
    });

    await expect(pmEvent).resolves.toMatchObject({ isInternal: true });
    await clientEvent;
  });
});
