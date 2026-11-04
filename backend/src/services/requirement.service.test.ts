import { Types } from 'mongoose';
import type { RequirementStatus } from '../models/requirement.model';
import type { UserRole } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import {
  appendRequirementVersion,
  assertRequirementEditable,
  assertRequirementStatusChange,
  sanitizeRichText,
} from './requirement.service';

const clientId = new Types.ObjectId().toString();
const editorId = new Types.ObjectId().toString();

function change(
  currentStatus: RequirementStatus,
  targetStatus: RequirementStatus,
  actorRole: UserRole,
  actorId = clientId,
): void {
  assertRequirementStatusChange({
    currentStatus,
    targetStatus,
    actor: { id: actorId, role: actorRole },
    projectClientId: clientId,
  });
}

describe('requirement status transitions', () => {
  it('lets the client owner submit a draft', () => {
    expect(() => change('draft', 'submitted', 'client')).not.toThrow();
  });

  it('blocks non-owners from submitting a draft', () => {
    expect(() => change('draft', 'submitted', 'client', new Types.ObjectId().toString())).toThrow(
      ApiError,
    );
    expect(() => change('draft', 'submitted', 'pm')).toThrow(ApiError);
    expect(() => change('draft', 'submitted', 'developer')).toThrow(ApiError);
  });

  it('lets a PM start review and request changes', () => {
    expect(() => change('submitted', 'under_review', 'pm')).not.toThrow();
    expect(() => change('under_review', 'clarification', 'pm')).not.toThrow();
    expect(() => change('under_review', 'rejected', 'pm')).not.toThrow();
  });

  it('lets the client owner or a PM approve an under-review requirement', () => {
    expect(() => change('under_review', 'approved', 'client')).not.toThrow();
    expect(() => change('under_review', 'approved', 'pm')).not.toThrow();
  });

  it('lets the client owner resubmit after clarification', () => {
    expect(() => change('clarification', 'submitted', 'client')).not.toThrow();
  });

  it('rejects invalid or terminal transitions', () => {
    expect(() => change('draft', 'approved', 'pm')).toThrow(ApiError);
    expect(() => change('approved', 'submitted', 'pm')).toThrow(ApiError);
    expect(() => change('rejected', 'submitted', 'client')).toThrow(ApiError);
  });

  it('allows admins to perform valid transitions', () => {
    expect(() => change('under_review', 'approved', 'admin', new Types.ObjectId().toString())).not.toThrow();
  });
});

describe('requirement editing', () => {
  it('blocks edits once a requirement is approved', () => {
    expect(() => assertRequirementEditable('approved')).toThrow(ApiError);
  });

  it('allows edits while the requirement is not approved', () => {
    expect(() => assertRequirementEditable('draft')).not.toThrow();
    expect(() => assertRequirementEditable('clarification')).not.toThrow();
  });
});

describe('requirement versions', () => {
  it('appends a version on every edit without mutating previous history', () => {
    const first = appendRequirementVersion([], {
      title: 'Original',
      description: '<p>Original scope</p>',
      editedBy: editorId,
      editedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const second = appendRequirementVersion(first, {
      title: 'Updated',
      description: '<p>Updated scope</p>',
      editedBy: editorId,
      editedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(second[0].title).toBe('Original');
    expect(second[1].title).toBe('Updated');
    expect(second[1].editedBy.toString()).toBe(editorId);
  });
});

describe('rich text sanitisation', () => {
  it('removes scripts and unsafe attributes while keeping formatting', () => {
    const sanitized = sanitizeRichText(
      '<p onclick="alert(1)">Hello <strong>team</strong></p><script>alert(1)</script>',
    );

    expect(sanitized).toContain('<strong>team</strong>');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onclick');
  });
});
