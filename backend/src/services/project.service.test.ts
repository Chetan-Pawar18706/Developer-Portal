import { Types } from 'mongoose';
import type { ProjectAttributes, ProjectStatus } from '../models/project.model';
import type { UserRole } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import {
  assertStatusChange,
  buildProjectVisibilityFilter,
  canAccessProject,
} from './project.service';

const clientId = new Types.ObjectId().toString();
const developerId = new Types.ObjectId().toString();
const outsiderId = new Types.ObjectId().toString();

function makeProject(client = clientId, members: string[] = []): Pick<
  ProjectAttributes,
  'client' | 'members'
> {
  return {
    client: new Types.ObjectId(client),
    members: members.map((userId) => ({
      user: new Types.ObjectId(userId),
      role: 'developer' as UserRole,
    })),
  };
}

function change(
  currentStatus: ProjectStatus,
  targetStatus: ProjectStatus,
  actorRole: UserRole,
  actorId = clientId,
  signOff?: { note?: string; rating?: number; feedback?: string },
): void {
  assertStatusChange({
    currentStatus,
    targetStatus,
    actor: { id: actorId, role: actorRole },
    projectClientId: clientId,
    signOff,
  });
}

describe('project visibility and access', () => {
  it('limits clients to their own projects and memberships', () => {
    const filter = buildProjectVisibilityFilter({ id: clientId, role: 'client' });
    const branches = filter.$or as unknown as Array<{
      client?: Types.ObjectId;
      'members.user'?: Types.ObjectId;
    }>;

    expect(branches).toHaveLength(2);
    expect(branches[0]?.client?.toString()).toBe(clientId);
    expect(branches[1]?.['members.user']?.toString()).toBe(clientId);
  });

  it('limits developers to assigned projects', () => {
    const filter = buildProjectVisibilityFilter({ id: developerId, role: 'developer' });

    expect((filter['members.user'] as Types.ObjectId).toString()).toBe(developerId);
    expect(filter.$or).toBeUndefined();
  });

  it('lets PMs and admins list the whole portfolio', () => {
    expect(buildProjectVisibilityFilter({ id: outsiderId, role: 'pm' })).toEqual({});
    expect(buildProjectVisibilityFilter({ id: outsiderId, role: 'admin' })).toEqual({});
  });

  it('allows the client owner and explicit members only', () => {
    const project = makeProject(clientId, [developerId]);

    expect(canAccessProject(project, { id: clientId, role: 'client' })).toBe(true);
    expect(canAccessProject(project, { id: developerId, role: 'developer' })).toBe(true);
    expect(canAccessProject(project, { id: outsiderId, role: 'client' })).toBe(false);
    expect(canAccessProject(project, { id: outsiderId, role: 'developer' })).toBe(false);
  });

  it('gives portfolio access to leadership', () => {
    const project = makeProject(clientId, []);

    expect(canAccessProject(project, { id: outsiderId, role: 'pm' })).toBe(true);
    expect(canAccessProject(project, { id: outsiderId, role: 'admin' })).toBe(true);
  });
});

describe('project status transitions', () => {
  it('lets the client owner submit a draft', () => {
    expect(() => change('draft', 'submitted', 'client')).not.toThrow();
  });

  it('does not let other clients or staff submit a draft', () => {
    expect(() => change('draft', 'submitted', 'client', outsiderId)).toThrow(ApiError);
    expect(() => change('draft', 'submitted', 'pm', outsiderId)).toThrow(ApiError);
  });

  it('lets PMs start a review or activate submitted work', () => {
    expect(() => change('submitted', 'in_review', 'pm', outsiderId)).not.toThrow();
    expect(() => change('submitted', 'active', 'admin', outsiderId)).not.toThrow();
    expect(() => change('in_review', 'active', 'pm', outsiderId)).not.toThrow();
  });

  it('lets leadership pause and resume active work', () => {
    expect(() => change('active', 'on_hold', 'pm', outsiderId)).not.toThrow();
    expect(() => change('on_hold', 'active', 'admin', outsiderId)).not.toThrow();
  });

  it('rejects transitions that are not in the map', () => {
    expect(() => change('draft', 'active', 'pm', outsiderId)).toThrow(
      'A project cannot move from draft to active',
    );
    expect(() => change('archived', 'active', 'admin', outsiderId)).toThrow(ApiError);
  });

  it('requires client sign-off to complete delivery', () => {
    expect(() => change('active', 'completed', 'pm', outsiderId)).toThrow(ApiError);
    expect(() => change('active', 'completed', 'client')).toThrow(
      'Delivery sign-off details are required',
    );

    expect(() =>
      change('active', 'completed', 'client', clientId, {
        rating: 5,
        note: 'Delivered as agreed',
      }),
    ).not.toThrow();
  });

  it('prevents developers from changing project status', () => {
    expect(() => change('active', 'on_hold', 'developer', developerId)).toThrow(ApiError);
  });
});
