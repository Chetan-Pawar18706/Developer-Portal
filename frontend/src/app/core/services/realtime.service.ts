import { Injectable, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import type {
  EntityDeletedEvent,
  PresenceUpdateEvent,
  PresenceUser,
  RealtimeCommentEvent,
  RealtimeFileEvent,
  RealtimeIssueEvent,
  RealtimeNotificationEvent,
  RealtimeRequirementEvent,
  RealtimeTaskEvent,
  TypingEvent,
} from '../models/realtime.model';
import { AuthService } from './auth.service';

const EVENTS = {
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

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);

  private socket: Socket | null = null;
  private connectedToken: string | null = null;
  private activeProjectId: string | null = null;

  private readonly taskCreated = new Subject<RealtimeTaskEvent>();
  private readonly taskUpdated = new Subject<RealtimeTaskEvent>();
  private readonly taskMoved = new Subject<RealtimeTaskEvent>();
  private readonly taskDeleted = new Subject<EntityDeletedEvent>();
  private readonly commentCreated = new Subject<RealtimeCommentEvent>();
  private readonly commentUpdated = new Subject<RealtimeCommentEvent>();
  private readonly commentDeleted = new Subject<EntityDeletedEvent>();
  private readonly issueCreated = new Subject<RealtimeIssueEvent>();
  private readonly issueUpdated = new Subject<RealtimeIssueEvent>();
  private readonly requirementCreated = new Subject<RealtimeRequirementEvent>();
  private readonly requirementUpdated = new Subject<RealtimeRequirementEvent>();
  private readonly notificationNew = new Subject<RealtimeNotificationEvent>();
  private readonly fileUploaded = new Subject<RealtimeFileEvent>();
  private readonly fileUpdated = new Subject<RealtimeFileEvent>();
  private readonly fileDeleted = new Subject<EntityDeletedEvent>();
  private readonly typing = new Subject<TypingEvent>();

  readonly connected = signal(false);
  readonly onlineUsers = signal<readonly PresenceUser[]>([]);

  readonly taskCreated$ = this.taskCreated.asObservable();
  readonly taskUpdated$ = this.taskUpdated.asObservable();
  readonly taskMoved$ = this.taskMoved.asObservable();
  readonly taskDeleted$ = this.taskDeleted.asObservable();
  readonly commentCreated$ = this.commentCreated.asObservable();
  readonly commentUpdated$ = this.commentUpdated.asObservable();
  readonly commentDeleted$ = this.commentDeleted.asObservable();
  readonly issueCreated$ = this.issueCreated.asObservable();
  readonly issueUpdated$ = this.issueUpdated.asObservable();
  readonly requirementCreated$ = this.requirementCreated.asObservable();
  readonly requirementUpdated$ = this.requirementUpdated.asObservable();
  readonly notificationNew$ = this.notificationNew.asObservable();
  readonly fileUploaded$ = this.fileUploaded.asObservable();
  readonly fileUpdated$ = this.fileUpdated.asObservable();
  readonly fileDeleted$ = this.fileDeleted.asObservable();
  readonly typing$ = this.typing.asObservable();

  constructor() {
    effect(() => {
      const token = this.auth.accessToken();

      if (token) {
        this.connect(token);
      } else {
        this.disconnect();
      }
    });
  }

  joinProject(projectId: string): void {
    if (!projectId || this.activeProjectId === projectId) {
      return;
    }

    if (this.activeProjectId) {
      this.socket?.emit('project:leave', this.activeProjectId);
    }

    this.activeProjectId = projectId;
    this.onlineUsers.set([]);

    if (this.socket?.connected) {
      this.socket.emit('project:join', projectId);
    }
  }

  leaveProject(projectId?: string): void {
    if (projectId && this.activeProjectId !== projectId) {
      return;
    }

    if (this.activeProjectId && this.socket?.connected) {
      this.socket.emit('project:leave', this.activeProjectId);
    }

    this.activeProjectId = null;
    this.onlineUsers.set([]);
  }

  sendTyping(
    projectId: string,
    entityType: string,
    entityId: string,
    isInternal: boolean,
    isTyping: boolean,
  ): void {
    if (!this.socket?.connected || !projectId) {
      return;
    }

    this.socket.emit('typing', {
      projectId,
      entityType,
      entityId,
      isInternal,
      isTyping,
    });
  }

  private connect(token: string): void {
    if (this.connectedToken === token && this.socket) {
      return;
    }

    this.disconnect();
    this.connectedToken = token;

    const socket = io(environment.socketUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    this.socket = socket;

    socket.on('connect', () => {
      this.connected.set(true);

      if (this.activeProjectId) {
        socket.emit('project:join', this.activeProjectId);
      }
    });

    socket.on('disconnect', () => {
      this.connected.set(false);
      this.onlineUsers.set([]);
    });

    socket.on('connect_error', () => this.connected.set(false));

    this.bindEvents(socket);
  }

  private disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.connectedToken = null;
    this.connected.set(false);
    this.onlineUsers.set([]);
  }

  private bindEvents(socket: Socket): void {
    socket.on(EVENTS.TASK_CREATED, (task: RealtimeTaskEvent) => this.taskCreated.next(task));
    socket.on(EVENTS.TASK_UPDATED, (task: RealtimeTaskEvent) => this.taskUpdated.next(task));
    socket.on(EVENTS.TASK_MOVED, (task: RealtimeTaskEvent) => this.taskMoved.next(task));
    socket.on(EVENTS.TASK_DELETED, (event: EntityDeletedEvent) => this.taskDeleted.next(event));

    socket.on(EVENTS.COMMENT_CREATED, (comment: RealtimeCommentEvent) =>
      this.commentCreated.next(comment),
    );
    socket.on(EVENTS.COMMENT_UPDATED, (comment: RealtimeCommentEvent) =>
      this.commentUpdated.next(comment),
    );
    socket.on(EVENTS.COMMENT_DELETED, (event: EntityDeletedEvent) =>
      this.commentDeleted.next(event),
    );

    socket.on(EVENTS.ISSUE_CREATED, (issue: RealtimeIssueEvent) => this.issueCreated.next(issue));
    socket.on(EVENTS.ISSUE_UPDATED, (issue: RealtimeIssueEvent) => this.issueUpdated.next(issue));

    socket.on(EVENTS.REQUIREMENT_CREATED, (requirement: RealtimeRequirementEvent) =>
      this.requirementCreated.next(requirement),
    );
    socket.on(EVENTS.REQUIREMENT_UPDATED, (requirement: RealtimeRequirementEvent) =>
      this.requirementUpdated.next(requirement),
    );

    socket.on(EVENTS.NOTIFICATION_NEW, (notification: RealtimeNotificationEvent) =>
      this.notificationNew.next(notification),
    );

    socket.on(EVENTS.FILE_UPLOADED, (file: RealtimeFileEvent) => this.fileUploaded.next(file));
    socket.on(EVENTS.FILE_UPDATED, (file: RealtimeFileEvent) => this.fileUpdated.next(file));
    socket.on(EVENTS.FILE_DELETED, (event: EntityDeletedEvent) => this.fileDeleted.next(event));

    socket.on(EVENTS.PRESENCE_UPDATE, (event: PresenceUpdateEvent) => {
      if (event.projectId === this.activeProjectId) {
        this.onlineUsers.set(event.onlineUsers);
      }
    });

    socket.on(EVENTS.TYPING, (event: TypingEvent) => this.typing.next(event));
  }
}
