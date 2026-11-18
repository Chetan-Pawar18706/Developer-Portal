import { expect, test, type Page } from '@playwright/test';

const client = {
  email: process.env['E2E_CLIENT_EMAIL'] ?? 'nikhilsury@gmail.com',
  password: process.env['E2E_CLIENT_PASSWORD'] ?? 'nikhil@123',
};
const pm = {
  email: process.env['E2E_PM_EMAIL'] ?? 'chetanpawar18706@gmail.com',
  password: process.env['E2E_PM_PASSWORD'] ?? 'Chetan@123',
};
const developer = {
  email: process.env['E2E_DEVELOPER_EMAIL'] ?? 'raghavshastri@gmail.com',
  password: process.env['E2E_DEVELOPER_PASSWORD'] ?? 'raghav@123',
};

interface Credentials {
  email: string;
  password: string;
}

async function signIn(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
}

function idFromUrl(url: string, pattern: RegExp): string {
  const id = url.match(pattern)?.[1];

  if (!id) {
    throw new Error(`Could not extract an id from ${url}`);
  }

  return id;
}

test.describe.serial('client-to-developer delivery flow', () => {
  test('client creates a project and requirement, PM reviews, developer delivers, client approves', async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-7);
    const projectTitle = `E2E Delivery Project ${suffix}`;
    const requirementTitle = `E2E requirement ${suffix}`;
    const taskTitle = `E2E task ${suffix}`;
    let projectId = '';
    let requirementId = '';

    await test.step('client signs in and creates a project', async () => {
      await signIn(page, client);
      await page.goto('/projects/new');
      await page.getByLabel('Project title').fill(projectTitle);
      await page.getByLabel('Brief').fill(
        'An end-to-end project created by the automated delivery flow test.',
      );
      await page.locator('button:visible', { hasText: 'Continue' }).click();
      await page.locator('button:visible', { hasText: 'Continue' }).click();
      await page.getByRole('button', { name: 'Create project' }).click();

      await expect(page).toHaveURL(/\/projects\/[a-f0-9]{24}\/overview$/);
      projectId = idFromUrl(page.url(), /\/projects\/([a-f0-9]{24})/);
    });

    await test.step('client adds a requirement', async () => {
      await page.goto(`/projects/${projectId}/requirements/new`);
      await page.getByLabel('Requirement title').fill(requirementTitle);
      await page
        .locator('app-rich-text-editor [contenteditable="true"]')
        .fill('The delivery team can review and implement this automated requirement.');
      await page
        .getByLabel('Acceptance criteria')
        .fill('Given the requirement exists\nWhen the PM reviews it\nThen the client can approve it');
      await page.getByRole('button', { name: 'Create requirement' }).click();

      await expect(page).toHaveURL(/\/requirements\/[a-f0-9]{24}$/);
      requirementId = idFromUrl(page.url(), /\/requirements\/([a-f0-9]{24})$/);
      await expect(page.getByText('Draft', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Submit for review' }).click();
      await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
    });

    await test.step('PM joins the project and starts the requirement review', async () => {
      await signOut(page);
      await signIn(page, pm);
      await page.goto(`/projects/${projectId}/overview`);
      await page.getByRole('button', { name: 'Add member' }).click();

      const memberDialog = page.getByRole('dialog');
      await memberDialog.getByLabel('Person').click();
      await page.getByRole('option', { name: /Raghav Shastri/ }).click();
      await memberDialog.getByLabel('Project role').click();
      await page.getByRole('option', { name: 'Developer', exact: true }).click();
      await memberDialog.getByRole('button', { name: 'Add member' }).click();
      await expect(memberDialog).toBeHidden();

      await page.goto(`/projects/${projectId}/requirements/${requirementId}`);
      await page.getByRole('button', { name: 'Start review' }).click();
      await expect(page.getByText('Under review', { exact: true })).toBeVisible();
    });

    await test.step('client approves the reviewed requirement', async () => {
      await signOut(page);
      await signIn(page, client);
      await page.goto(`/projects/${projectId}/requirements/${requirementId}`);
      await page.getByRole('button', { name: 'Approve requirement' }).click();
      await expect(page.getByText('Approved scope')).toBeVisible();
    });

    await test.step('PM creates a task for the developer', async () => {
      await signOut(page);
      await signIn(page, pm);
      await page.goto(`/projects/${projectId}/tasks`);
      await page.getByRole('button', { name: 'New task' }).click();

      const taskDialog = page.getByRole('dialog');
      await taskDialog.getByLabel('Task title').fill(taskTitle);
      await taskDialog.getByLabel('Assignee').click();
      await page.getByRole('option', { name: /Raghav Shastri/ }).click();
      await taskDialog.getByLabel('Linked requirement').click();
      await page.getByRole('option', { name: requirementTitle }).click();
      await taskDialog.getByRole('button', { name: 'Create task' }).click();

      await expect(taskDialog).toBeHidden();
      await expect(page.getByText(taskTitle)).toBeVisible();
    });

    await test.step('developer moves the task to in review', async () => {
      await signOut(page);
      await signIn(page, developer);
      await page.goto(`/projects/${projectId}/tasks`);
      await page.locator('.task-card', { hasText: taskTitle }).click();

      const taskDialog = page.getByRole('dialog');
      await taskDialog.getByLabel('Status').click();
      await page.getByRole('option', { name: 'In review', exact: true }).click();
      await taskDialog.getByRole('button', { name: 'Save changes' }).click();

      await expect(taskDialog).toBeHidden();
      await expect(
        page.locator('#task-column-in_review .task-card', { hasText: taskTitle }),
      ).toBeVisible();
    });

    await test.step('client approves the delivered task', async () => {
      await signOut(page);
      await signIn(page, client);
      await page.goto(`/projects/${projectId}/tasks`);
      await page.locator('.task-card', { hasText: taskTitle }).click();

      const taskDialog = page.getByRole('dialog');
      await taskDialog.getByRole('button', { name: 'Approve task' }).click();

      await expect(page.getByText('Task approved')).toBeVisible();
      await expect(taskDialog).toBeHidden();
    });
  });
});
