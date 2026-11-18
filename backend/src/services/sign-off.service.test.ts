import { Types } from 'mongoose';
import type { ProjectStatus } from '../models/project.model';
import { ApiError } from '../utils/ApiError';
import {
  assertCanSignOff,
  type SignOffEligibilityInput,
} from './project.service';

const clientId = new Types.ObjectId().toString();
const staffId = new Types.ObjectId().toString();

function eligibility(overrides: Partial<SignOffEligibilityInput> = {}): SignOffEligibilityInput {
  return {
    actor: { id: clientId, role: 'client' },
    projectClientId: clientId,
    status: 'active',
    incompleteTaskCount: 0,
    openCriticalIssueCount: 0,
    ...overrides,
  };
}

function projectStatus(status: ProjectStatus): SignOffEligibilityInput {
  return eligibility({ status });
}

describe('delivery sign-off rules', () => {
  it('allows the client owner when delivery is ready', () => {
    expect(() => assertCanSignOff(eligibility())).not.toThrow();
    expect(() => assertCanSignOff(eligibility({ status: 'on_hold' }))).not.toThrow();
  });

  it('rejects staff and other clients', () => {
    expect(() =>
      assertCanSignOff(eligibility({ actor: { id: staffId, role: 'pm' } })),
    ).toThrow('Only the client owner can sign off delivery');
    expect(() =>
      assertCanSignOff(eligibility({ actor: { id: staffId, role: 'client' } })),
    ).toThrow(ApiError);
  });

  it('only allows sign-off from an active delivery phase', () => {
    for (const status of ['draft', 'submitted', 'in_review', 'completed', 'archived'] as const) {
      expect(() => assertCanSignOff(projectStatus(status))).toThrow(
        'Only active projects can be signed off',
      );
    }
  });

  it('blocks sign-off while tasks are incomplete', () => {
    expect(() => assertCanSignOff(eligibility({ incompleteTaskCount: 2 }))).toThrow(
      '2 tasks are still incomplete',
    );
    expect(() => assertCanSignOff(eligibility({ incompleteTaskCount: 1 }))).toThrow(ApiError);
  });

  it('blocks sign-off while critical issues are open', () => {
    expect(() => assertCanSignOff(eligibility({ openCriticalIssueCount: 1 }))).toThrow(
      '1 critical issue is still open',
    );
    expect(() => assertCanSignOff(eligibility({ openCriticalIssueCount: 3 }))).toThrow(
      '3 critical issues are still open',
    );
  });
});
