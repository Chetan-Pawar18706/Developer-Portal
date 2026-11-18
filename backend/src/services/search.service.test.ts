import { File } from '../models/file.model';
import { Issue } from '../models/issue.model';
import { Project } from '../models/project.model';
import { Requirement } from '../models/requirement.model';
import { Task } from '../models/task.model';
import { clearTestDatabase, startTestDatabase, stopTestDatabase } from '../tests/test-db';
import { createUser } from '../tests/factories';
import {
  searchWorkspace,
  type SearchResult,
  type SearchResultType,
} from './search.service';

const SEARCH_INDEXES = [Project, Requirement, Task, Issue, File];

function itemsOfType(result: SearchResult, type: SearchResultType): SearchResult['groups'][number]['items'] {
  return result.groups.find((group) => group.type === type)?.items ?? [];
}

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase();
  await Promise.all(SEARCH_INDEXES.map((model) => model.createIndexes()));
});

describe('workspace search scoping', () => {
  it('returns only projects and records the actor can access', async () => {
    const client = await createUser({ email: 'search-client@example.com', role: 'client' });
    const developer = await createUser({ email: 'search-dev@example.com', role: 'developer' });
    const outsider = await createUser({ email: 'search-outsider@example.com', role: 'client' });

    const project = await Project.create({
      title: 'Checkout Portal',
      description: 'Rebuild the checkout experience with a faster payment flow.',
      client: client._id,
      status: 'active',
      members: [
        { user: client._id, role: 'client' },
        { user: developer._id, role: 'developer' },
      ],
    });

    const outsideProject = await Project.create({
      title: 'Checkout Microsite',
      description: 'A separate marketing checkout project for another client.',
      client: outsider._id,
      status: 'active',
      members: [{ user: outsider._id, role: 'client' }],
    });

    await Requirement.create({
      project: project._id,
      title: 'Checkout requirement',
      description: 'Customers can complete a checkout in under two minutes.',
      createdBy: client._id,
    });

    await Task.create({
      project: project._id,
      title: 'Checkout payment API',
      description: 'Implement the checkout payment endpoint.',
      reporter: client._id,
    });

    await Issue.create({
      project: project._id,
      title: 'Checkout button glitch',
      description: 'The checkout button does not respond on mobile devices.',
      raisedBy: client._id,
    });

    await File.create({
      project: project._id,
      name: 'checkout-spec',
      originalName: 'checkout-spec.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: 'private/checkout-spec.pdf',
      uploadedBy: client._id,
    });

    await File.create({
      project: outsideProject._id,
      name: 'outside-checkout-spec',
      originalName: 'outside-checkout-spec.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: 'private/outside-checkout-spec.pdf',
      uploadedBy: outsider._id,
    });

    const result = await searchWorkspace(
      { id: client.id, role: 'client' },
      { q: 'checkout', limit: 10 },
    );

    expect(result.query).toBe('checkout');
    expect(result.total).toBeGreaterThan(0);
    expect(itemsOfType(result, 'project').map((item) => item.id)).toContain(project.id);
    expect(itemsOfType(result, 'project').map((item) => item.id)).not.toContain(
      outsideProject.id,
    );
    expect(itemsOfType(result, 'file').map((item) => item.title)).toContain('checkout-spec.pdf');
    expect(itemsOfType(result, 'file').map((item) => item.title)).not.toContain(
      'outside-checkout-spec.pdf',
    );
  });

  it('hides internal files from clients but keeps them visible to staff', async () => {
    const client = await createUser({ email: 'file-client@example.com', role: 'client' });
    const pm = await createUser({ email: 'file-pm@example.com', role: 'pm' });

    const project = await Project.create({
      title: 'Portal Delivery',
      description: 'Deliver the shared client portal and its reporting tools.',
      client: client._id,
      status: 'active',
      members: [
        { user: client._id, role: 'client' },
        { user: pm._id, role: 'pm' },
      ],
    });

    await File.create({
      project: project._id,
      name: 'roadmap',
      originalName: 'roadmap.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: 'private/roadmap.pdf',
      uploadedBy: pm._id,
      isInternal: false,
    });

    await File.create({
      project: project._id,
      name: 'internal-roadmap',
      originalName: 'internal-roadmap.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: 'private/internal-roadmap.pdf',
      uploadedBy: pm._id,
      isInternal: true,
    });

    const clientResult = await searchWorkspace(
      { id: client.id, role: 'client' },
      { q: 'roadmap', limit: 10 },
    );
    const staffResult = await searchWorkspace(
      { id: pm.id, role: 'pm' },
      { q: 'roadmap', limit: 10 },
    );

    expect(itemsOfType(clientResult, 'file').map((item) => item.title)).toEqual(['roadmap.pdf']);
    expect(itemsOfType(staffResult, 'file').map((item) => item.title)).toEqual(
      expect.arrayContaining(['roadmap.pdf', 'internal-roadmap.pdf']),
    );
  });

  it('returns no results when the actor has no accessible projects', async () => {
    const owner = await createUser({ email: 'lonely-owner@example.com', role: 'client' });
    const outsider = await createUser({ email: 'lonely-outsider@example.com', role: 'developer' });

    await Project.create({
      title: 'Private Portal',
      description: 'A private client portal with no shared team members.',
      client: owner._id,
      status: 'active',
      members: [{ user: owner._id, role: 'client' }],
    });

    const result = await searchWorkspace(
      { id: outsider.id, role: 'developer' },
      { q: 'portal', limit: 10 },
    );

    expect(result.total).toBe(0);
    expect(result.groups).toHaveLength(5);
  });
});
