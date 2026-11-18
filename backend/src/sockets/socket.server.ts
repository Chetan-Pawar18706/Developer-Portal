import type { Server as HttpServer } from 'node:http';
import { Types } from 'mongoose';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { Project } from '../models/project.model';
import type { UserRole } from '../models/user.model';
import { User } from '../models/user.model';
import { verifyAccessToken } from '../utils/token';

export const REALTIME_EVENTS = {
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_MOVED: 'task:moved',
  TASK_DELETED: 'task:deleted',
  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',
  ISSUE_CREATED: 'issue:created',
  ISSUE_UPDATED: 'issue:updated',
  REQUIREMENT_CREATED: 'requirement:created',
  REQUIREMENT_UPDATED: 'requirement:updated',
  NOTIFICATION_NEW: 'notification:new',
  FILE_UPLOADED: 'file:uploaded',
  FILE_UPDATED: 'file:updated',
  FILE_DELETED: 'file:deleted',
  PRESENCE_UPDATE: 'presence:update',
  TYPING: 'typing',
} as const;

export const projectRoom = (projectId: string): string => `project:${projectId}`;
export const staffRoom = (projectId: string): string => `staff:${projectId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

const STAFF_ROLES: readonly UserRole[] = ['admin', 'pm', 'developer'];

function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

interface Identity {
  userId: string;
  role: UserRole;
  projectIds: string[];
}

interface PresenceMember {
  userId: string;
  name: string;
  role: UserRole;
}

interface TypingPayload {
  projectId: string;
  entityType: string;
  entityId: string;
  isInternal: boolean;
  isTyping: boolean;
}

function identityOf(socket: Socket): Identity {
  return socket.data['identity'] as Identity;
}

let io: Server | null = null;
const presence = new Map<string, Map<string, PresenceMember>>();

function projectFilter(userId: string, role: UserRole): Record<string, unknown> {
  if (role === 'admin') {
    return {};
  }

  if (role === 'client') {
    return { client: new Types.ObjectId(userId) };
  }

  return {
    $or: [
      { client: new Types.ObjectId(userId) },
      { 'members.user': new Types.ObjectId(userId) },
    ],
  };
}

function emitToRoom(room: string, event: string, payload: unknown): void {
  io?.to(room).emit(event, payload);
}

export function emitToProject(projectId: string, event: string, payload: unknown): void {
  emitToRoom(projectRoom(projectId), event, payload);
}

export function emitToStaff(projectId: string, event: string, payload: unknown): void {
  emitToRoom(staffRoom(projectId), event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  emitToRoom(userRoom(userId), event, payload);
}

/**
 * Internal comments and files are only broadcast to the staff room. Clients
 * never join that room, so this keeps internal payloads off client sockets.
 */
export function emitProjectEvent(
  projectId: string,
  event: string,
  payload: unknown,
  isInternal = false,
): void {
  if (isInternal) {
    emitToStaff(projectId, event, payload);
    return;
  }

  emitToProject(projectId, event, payload);
}

function broadcastPresence(projectId: string): void {
  const members = [...(presence.get(projectId)?.values() ?? [])];
  emitToProject(projectId, REALTIME_EVENTS.PRESENCE_UPDATE, {
    projectId,
    onlineUsers: members,
  });
}

function removePresence(projectId: string, userId: string): void {
  const members = presence.get(projectId);

  if (!members?.has(userId) || !io) {
    return;
  }

  const stillOnline = [...io.sockets.sockets.values()].some((socket) => {
    const identity = socket.data['identity'] as Identity | undefined;
    return identity?.userId === userId && socket.rooms.has(projectRoom(projectId));
  });

  if (!stillOnline) {
    members.delete(userId);
  }

  if (members.size === 0) {
    presence.delete(projectId);
  }

  broadcastPresence(projectId);
}

function tokenFromHandshake(socket: Socket): string | null {
  const authToken = socket.handshake.auth['token'];

  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

async function authorizedProjectIds(identity: Identity): Promise<string[]> {
  const projects = await Project.find(projectFilter(identity.userId, identity.role)).select('_id');
  return projects.map((project) => project._id.toString());
}

async function resolveIdentity(socket: Socket): Promise<Identity> {
  const token = tokenFromHandshake(socket);

  if (!token) {
    throw new Error('Missing access token');
  }

  const payload = verifyAccessToken(token);

  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }

  const user = await User.findById(payload.sub).select('role isActive').lean();

  if (!user || !user.isActive) {
    throw new Error('Inactive or missing user');
  }

  const identity: Identity = {
    userId: payload.sub,
    role: user.role,
    projectIds: [],
  };
  identity.projectIds = await authorizedProjectIds(identity);
  return identity;
}

async function refreshAuthorizedProjectIds(identity: Identity): Promise<void> {
  identity.projectIds = await authorizedProjectIds(identity);
}

function joinProjectRooms(socket: Socket, projectId: string, identity: Identity): void {
  if (
    !Types.ObjectId.isValid(projectId) ||
    !identity.projectIds.includes(projectId)
  ) {
    return;
  }

  void socket.join(projectRoom(projectId));

  if (isStaff(identity.role)) {
    void socket.join(staffRoom(projectId));
  }
}

async function joinProject(socket: Socket, projectId: string): Promise<void> {
  const identity = identityOf(socket);
  await refreshAuthorizedProjectIds(identity);
  joinProjectRooms(socket, projectId, identity);
}

export function revokeProjectAccess(userId: string, projectId: string): void {
  if (!io) {
    return;
  }

  for (const socket of io.sockets.sockets.values()) {
    const identity = identityOf(socket);

    if (identity?.userId !== userId) {
      continue;
    }

    void socket.leave(projectRoom(projectId));
    void socket.leave(staffRoom(projectId));
    identity.projectIds = identity.projectIds.filter((id) => id !== projectId);
  }

  removePresence(projectId, userId);
}

export async function initSocketServer(httpServer: HttpServer): Promise<Server> {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      socket.data['identity'] = await resolveIdentity(socket);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const identity = identityOf(socket);

    void socket.join(userRoom(identity.userId));

    for (const projectId of identity.projectIds) {
      joinProjectRooms(socket, projectId, identity);
    }

    void User.findById(identity.userId)
      .select('name')
      .then((user) => {
        const name = user?.name ?? 'Team member';

        for (const projectId of identity.projectIds) {
          const members = presence.get(projectId) ?? new Map<string, PresenceMember>();
          members.set(identity.userId, {
            userId: identity.userId,
            name,
            role: identity.role,
          });
          presence.set(projectId, members);
          broadcastPresence(projectId);
        }
      });

    socket.on('project:join', (projectId: unknown) => {
      if (typeof projectId === 'string') {
        void joinProject(socket, projectId);
      }
    });

    socket.on('project:leave', (projectId: unknown) => {
      if (typeof projectId !== 'string') {
        return;
      }

      void socket.leave(projectRoom(projectId));
      void socket.leave(staffRoom(projectId));
      removePresence(projectId, identity.userId);
    });

    socket.on('typing', (payload: TypingPayload) => {
      if (!payload || !Types.ObjectId.isValid(payload.projectId)) {
        return;
      }

      void refreshAuthorizedProjectIds(identity).then(() => {
        if (
          !identity.projectIds.includes(payload.projectId) ||
          (payload.isInternal && !isStaff(identity.role))
        ) {
          return;
        }

        const room = payload.isInternal
          ? staffRoom(payload.projectId)
          : projectRoom(payload.projectId);
        const member = presence.get(payload.projectId)?.get(identity.userId);

        socket.to(room).emit(REALTIME_EVENTS.TYPING, {
          ...payload,
          user: member ?? { userId: identity.userId, name: 'Team member', role: identity.role },
        });
      });
    });

    socket.on('disconnect', () => {
      for (const projectId of identity.projectIds) {
        removePresence(projectId, identity.userId);
      }
    });
  });

  return io;
}

export async function closeSocketServer(): Promise<void> {
  if (!io) {
    return;
  }

  await io.close();
  io = null;
  presence.clear();
}
