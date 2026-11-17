import { Types } from 'mongoose';
import { ActivityLog } from '../models/activityLog.model';
import {
  Project,
  type ProjectDocument,
} from '../models/project.model';
import { Requirement } from '../models/requirement.model';
import {
  Task,
  type TaskAttributes,
  type TaskClientReviewAttributes,
  type TaskPriority,
  type TaskStatus,
  type TaskSubtaskAttributes,
  type TaskTimeLogAttributes,
} from '../models/task.model';
import { User, type UserDocument } from '../models/user.model';

interface DemoTasksSubtask {
  title: string;
  done: boolean;
}

interface DemoTasksTimeLog {
  userEmail?: string;
  hours: number;
  note: string;
  daysAgo: number;
}

interface DemoTasksReview {
  status: 'approved' | 'changes_requested';
  note: string;
  byEmail?: string;
  atDaysAgo: number;
}

interface DemoTasksBlueprint {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimateHours: number;
  dueInDays: number | null;
  labels: string[];
  subtasks: DemoTasksSubtask[];
  assigneeEmail?: string;
  reporterEmail: string;
  requirementTitle?: string;
  createdDaysAgo: number;
  updatedDaysAgo?: number;
  timeLogs?: DemoTasksTimeLog[];
  clientReview?: DemoTasksReview;
}

export interface DemoTasksResult {
  created: number;
  skipped: number;
  projects: number;
}

export interface DemoTasksOptions {
  reset?: boolean;
}

const DEMO_TASKS: Record<string, readonly DemoTasksBlueprint[]> = {
  'Customer Portal Redesign': [
    {
      title: 'Harden password reset token flow',
      description:
        'Replace the legacy reset token format with single-use hashed tokens, add a 30 minute expiry and revoke existing sessions after a successful reset.',
      status: 'done',
      priority: 'critical',
      estimateHours: 14,
      dueInDays: -45,
      labels: ['security', 'backend'],
      subtasks: [
        { title: 'Generate hashed reset tokens', done: true },
        { title: 'Enforce 30 minute expiry', done: true },
        { title: 'Revoke active sessions', done: true },
        { title: 'Add audit log entry', done: true },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Password reset and account recovery',
      createdDaysAgo: 64,
      updatedDaysAgo: 52,
      timeLogs: [
        { hours: 6, note: 'Implemented token hashing and expiry checks.', daysAgo: 58 },
        { hours: 7.5, note: 'Session revocation and integration tests.', daysAgo: 53 },
      ],
      clientReview: {
        status: 'approved',
        note: 'Security review passed. Reset links behave as expected.',
        atDaysAgo: 51,
      },
    },
    {
      title: 'Refresh account recovery email template',
      description:
        'Update the reset email with clear expiry guidance, accessible markup and a support fallback link.',
      status: 'done',
      priority: 'high',
      estimateHours: 5,
      dueInDays: -49,
      labels: ['email', 'accessibility'],
      subtasks: [
        { title: 'Rewrite helper copy', done: true },
        { title: 'Check accessible markup', done: true },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Password reset and account recovery',
      createdDaysAgo: 61,
      updatedDaysAgo: 50,
      timeLogs: [{ hours: 4, note: 'Template and email client checks.', daysAgo: 51 }],
      clientReview: {
        status: 'approved',
        note: 'Approved with the revised expiry wording.',
        atDaysAgo: 50,
      },
    },
    {
      title: 'Build invoice history list and empty state',
      description:
        'List invoices newest first with amount, issue date and payment status. Include a helpful empty state for customers without billing history.',
      status: 'in_progress',
      priority: 'high',
      estimateHours: 10,
      dueInDays: 8,
      labels: ['frontend', 'billing'],
      subtasks: [
        { title: 'Invoice table component', done: true },
        { title: 'Status filters', done: false },
        { title: 'Empty state copy', done: true },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Invoice history and PDF downloads',
      createdDaysAgo: 20,
      updatedDaysAgo: 2,
      timeLogs: [{ hours: 5.5, note: 'Table layout and responsive states.', daysAgo: 3 }],
    },
    {
      title: 'Add authenticated invoice PDF download',
      description:
        'Generate PDF invoices on demand and ensure downloads are authorized for the signed-in customer only.',
      status: 'in_review',
      priority: 'high',
      estimateHours: 8,
      dueInDays: 3,
      labels: ['backend', 'pdf'],
      subtasks: [
        { title: 'PDF generation service', done: true },
        { title: 'Authorization middleware', done: true },
        { title: 'Download headers', done: true },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Invoice history and PDF downloads',
      createdDaysAgo: 18,
      updatedDaysAgo: 1,
      timeLogs: [{ hours: 7, note: 'PDF service and authorization tests.', daysAgo: 2 }],
    },
    {
      title: 'Clarify support ticket status labels',
      description:
        'Confirm the wording and timestamps for ticket statuses with the support operations team before implementing the customer view.',
      status: 'blocked',
      priority: 'medium',
      estimateHours: 3,
      dueInDays: -2,
      labels: ['discovery', 'support'],
      subtasks: [
        { title: 'Draft status glossary', done: true },
        { title: 'Get support team sign-off', done: false },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Support ticket status visibility',
      createdDaysAgo: 15,
      updatedDaysAgo: 4,
    },
    {
      title: 'Profile dashboard rendering performance',
      description:
        'Measure and reduce the initial render cost of the customer dashboard on mid-range mobile devices.',
      status: 'todo',
      priority: 'medium',
      estimateHours: 6,
      dueInDays: 25,
      labels: ['performance', 'frontend'],
      subtasks: [
        { title: 'Capture baseline metrics', done: false },
        { title: 'Defer non-critical widgets', done: false },
      ],
      reporterEmail: 'chetanpawar18706@gmail.com',
      createdDaysAgo: 9,
    },
  ],
  'Mobile Checkout Revamp': [
    {
      title: 'Implement saved payment method selector',
      description:
        'Show saved cards with brand and last four digits, and let customers choose one without re-entering card details.',
      status: 'in_progress',
      priority: 'critical',
      estimateHours: 12,
      dueInDays: 12,
      labels: ['payments', 'mobile'],
      subtasks: [
        { title: 'Fetch saved methods', done: true },
        { title: 'Selector component', done: true },
        { title: 'Remove saved method flow', done: false },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Saved payment methods at checkout',
      createdDaysAgo: 9,
      updatedDaysAgo: 1,
      timeLogs: [{ hours: 6.5, note: 'Selector component and API wiring.', daysAgo: 1 }],
    },
    {
      title: 'Integrate address validation provider',
      description:
        'Validate delivery addresses before payment submission and show inline correction hints for invalid entries.',
      status: 'blocked',
      priority: 'high',
      estimateHours: 9,
      dueInDays: 20,
      labels: ['integration', 'backend'],
      subtasks: [
        { title: 'Provider sandbox account', done: false },
        { title: 'Validation endpoint', done: false },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      createdDaysAgo: 8,
      updatedDaysAgo: 2,
    },
    {
      title: 'Design checkout skeleton loading states',
      description:
        'Add lightweight placeholders so the payment form appears interactive while non-critical assets continue loading.',
      status: 'todo',
      priority: 'medium',
      estimateHours: 5,
      dueInDays: 30,
      labels: ['frontend', 'performance'],
      subtasks: [{ title: 'Skeleton components', done: false }],
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Low-bandwidth checkout performance',
      createdDaysAgo: 6,
    },
    {
      title: 'Write throttled connection test plan',
      description:
        'Document the network throttling profile and acceptance checks for the low-bandwidth checkout requirement.',
      status: 'done',
      priority: 'medium',
      estimateHours: 4,
      dueInDays: -1,
      labels: ['qa', 'performance'],
      subtasks: [
        { title: 'Define throttling profile', done: true },
        { title: 'List acceptance checks', done: true },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Low-bandwidth checkout performance',
      createdDaysAgo: 7,
      updatedDaysAgo: 3,
      timeLogs: [{ hours: 3, note: 'Test plan drafted and reviewed with PM.', daysAgo: 3 }],
      clientReview: {
        status: 'approved',
        note: 'Test profile agreed for the next review cycle.',
        atDaysAgo: 2,
      },
    },
  ],
  'Inventory Sync Service': [
    {
      title: 'Build scheduled stock batch importer',
      description:
        'Poll the warehouse endpoint every five minutes, batch stock updates and record the last successful sync time per location.',
      status: 'done',
      priority: 'critical',
      estimateHours: 16,
      dueInDays: -60,
      labels: ['backend', 'integration'],
      subtasks: [
        { title: 'Scheduler configuration', done: true },
        { title: 'Batch upsert logic', done: true },
        { title: 'Sync health endpoint', done: true },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Batch stock updates every five minutes',
      createdDaysAgo: 88,
      updatedDaysAgo: 64,
      timeLogs: [
        { hours: 8, note: 'Importer service and scheduler.', daysAgo: 70 },
        { hours: 7, note: 'Health endpoint and retry handling.', daysAgo: 65 },
      ],
      clientReview: {
        status: 'approved',
        note: 'Freshness target accepted after the warehouse validation run.',
        atDaysAgo: 63,
      },
    },
    {
      title: 'Add retry queue for failed stock updates',
      description:
        'Move failed stock updates to a retry queue with exponential backoff and surface repeated failures in the service logs.',
      status: 'in_progress',
      priority: 'high',
      estimateHours: 10,
      dueInDays: 5,
      labels: ['backend', 'reliability'],
      subtasks: [
        { title: 'Retry queue schema', done: true },
        { title: 'Backoff policy', done: false },
        { title: 'Failure alerts', done: false },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Batch stock updates every five minutes',
      createdDaysAgo: 40,
      updatedDaysAgo: 5,
      timeLogs: [{ hours: 4.5, note: 'Queue schema and first retry worker.', daysAgo: 6 }],
    },
    {
      title: 'Add filters to mismatch reconciliation report',
      description:
        'Let operations filter mismatches by SKU, location and last sync time in the reconciliation view.',
      status: 'todo',
      priority: 'medium',
      estimateHours: 7,
      dueInDays: 18,
      labels: ['frontend', 'operations'],
      subtasks: [{ title: 'Filter controls', done: false }],
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Mismatch reconciliation report',
      createdDaysAgo: 28,
    },
    {
      title: 'Agree mismatch export format',
      description:
        'Confirm the CSV columns and date range with operations before implementing the mismatch export.',
      status: 'blocked',
      priority: 'medium',
      estimateHours: 3,
      dueInDays: -4,
      labels: ['discovery', 'operations'],
      subtasks: [{ title: 'Collect operations sample file', done: false }],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Mismatch reconciliation report',
      createdDaysAgo: 25,
      updatedDaysAgo: 12,
    },
  ],
  'Reporting & Analytics Dashboard': [
    {
      title: 'Build revenue trend aggregation job',
      description:
        'Aggregate monthly revenue, targets and contributing client accounts into a dashboard-ready dataset.',
      status: 'done',
      priority: 'critical',
      estimateHours: 18,
      dueInDays: -130,
      labels: ['data', 'backend'],
      subtasks: [
        { title: 'Revenue aggregation query', done: true },
        { title: 'Target comparison fields', done: true },
        { title: 'Scheduled refresh', done: true },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Executive revenue trend dashboard',
      createdDaysAgo: 155,
      updatedDaysAgo: 140,
      timeLogs: [{ hours: 16, note: 'Aggregation pipeline and refresh job.', daysAgo: 142 }],
      clientReview: {
        status: 'approved',
        note: 'Finance validated the target calculation.',
        atDaysAgo: 139,
      },
    },
    {
      title: 'Implement month drill-down interaction',
      description:
        'Clicking a month filters the revenue chart to the client accounts that contributed to that period.',
      status: 'done',
      priority: 'high',
      estimateHours: 9,
      dueInDays: -120,
      labels: ['frontend', 'charts'],
      subtasks: [
        { title: 'Chart click handler', done: true },
        { title: 'Filtered account table', done: true },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Executive revenue trend dashboard',
      createdDaysAgo: 148,
      updatedDaysAgo: 132,
      timeLogs: [{ hours: 8, note: 'Drill-down interaction and tests.', daysAgo: 134 }],
      clientReview: {
        status: 'approved',
        note: 'Approved after UAT walkthrough.',
        atDaysAgo: 131,
      },
    },
    {
      title: 'Add CSV export worker',
      description:
        'Export the currently filtered dashboard dataset with readable headings and ISO dates without blocking the UI.',
      status: 'done',
      priority: 'high',
      estimateHours: 11,
      dueInDays: -105,
      labels: ['backend', 'exports'],
      subtasks: [
        { title: 'Export worker', done: true },
        { title: 'Progress indicator', done: true },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Export dashboard data to CSV',
      createdDaysAgo: 128,
      updatedDaysAgo: 112,
      timeLogs: [{ hours: 10, note: 'Worker and progress reporting.', daysAgo: 114 }],
      clientReview: {
        status: 'approved',
        note: 'Export format matched the finance template.',
        atDaysAgo: 111,
      },
    },
    {
      title: 'Resolve final UAT defects',
      description:
        'Fix the remaining accessibility and chart labelling issues raised during the final user acceptance test.',
      status: 'done',
      priority: 'high',
      estimateHours: 8,
      dueInDays: -20,
      labels: ['qa', 'accessibility'],
      subtasks: [
        { title: 'Chart label contrast', done: true },
        { title: 'Keyboard navigation', done: true },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'chetanpawar18706@gmail.com',
      createdDaysAgo: 24,
      updatedDaysAgo: 12,
      timeLogs: [{ hours: 6, note: 'Accessibility fixes and regression pass.', daysAgo: 13 }],
      clientReview: {
        status: 'approved',
        note: 'Final UAT defects closed.',
        atDaysAgo: 11,
      },
    },
    {
      title: 'Design quarterly revenue comparison view',
      description:
        'Plan the quarterly comparison view requested in the approved change request without changing the existing monthly view.',
      status: 'todo',
      priority: 'medium',
      estimateHours: 7,
      dueInDays: 40,
      labels: ['discovery', 'charts'],
      subtasks: [{ title: 'Wireframe comparison view', done: false }],
      reporterEmail: 'chetanpawar18706@gmail.com',
      requirementTitle: 'Change request: quarterly revenue comparison',
      createdDaysAgo: 5,
    },
  ],
  'Vendor Onboarding Workflow': [
    {
      title: 'Map current onboarding handoffs',
      description:
        'Document the existing spreadsheet handoffs, approval steps and the data collected at each stage.',
      status: 'done',
      priority: 'high',
      estimateHours: 6,
      dueInDays: -1,
      labels: ['discovery', 'operations'],
      subtasks: [
        { title: 'Interview operations team', done: true },
        { title: 'Draw process map', done: true },
      ],
      assigneeEmail: 'nikhilsury@gmail.com',
      reporterEmail: 'nikhilsury@gmail.com',
      createdDaysAgo: 2,
      updatedDaysAgo: 1,
      timeLogs: [{ hours: 4, note: 'Process map from operations interview.', daysAgo: 1 }],
    },
    {
      title: 'Draft guided vendor application form',
      description:
        'Break the vendor application into steps for company details, tax information and document uploads with save-and-resume behaviour.',
      status: 'todo',
      priority: 'high',
      estimateHours: 14,
      dueInDays: 30,
      labels: ['frontend', 'workflow'],
      subtasks: [
        { title: 'Define step schema', done: false },
        { title: 'Autosave draft state', done: false },
      ],
      reporterEmail: 'nikhilsury@gmail.com',
      requirementTitle: 'Guided vendor application form',
      createdDaysAgo: 2,
    },
    {
      title: 'Specify document upload validation',
      description:
        'Define allowed file types, maximum size and the feedback shown for rejected uploads.',
      status: 'todo',
      priority: 'medium',
      estimateHours: 5,
      dueInDays: 35,
      labels: ['backend', 'files'],
      subtasks: [{ title: 'Validation rules checklist', done: false }],
      reporterEmail: 'nikhilsury@gmail.com',
      requirementTitle: 'Guided vendor application form',
      createdDaysAgo: 2,
    },
  ],
  'e com store': [
    {
      title: 'Design responsive product listing grid',
      description:
        'Create a product grid that adapts from two columns on mobile to four columns on desktop with clear price and availability labels.',
      status: 'in_progress',
      priority: 'high',
      estimateHours: 8,
      dueInDays: 10,
      labels: ['frontend', 'ui'],
      subtasks: [
        { title: 'Grid breakpoints', done: true },
        { title: 'Product card states', done: false },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'admin@devpor.com',
      createdDaysAgo: 12,
      updatedDaysAgo: 2,
      timeLogs: [{ hours: 3.5, note: 'Grid layout and card markup.', daysAgo: 2 }],
    },
    {
      title: 'Build product detail page',
      description:
        'Show product imagery, description, price, variants and add-to-cart controls with accessible markup.',
      status: 'todo',
      priority: 'high',
      estimateHours: 10,
      dueInDays: 18,
      labels: ['frontend', 'catalogue'],
      subtasks: [{ title: 'Variant selector', done: false }],
      reporterEmail: 'admin@devpor.com',
      createdDaysAgo: 10,
    },
    {
      title: 'Add cart quantity controls',
      description:
        'Let customers change quantities, remove items and see the updated subtotal without a full page reload.',
      status: 'in_review',
      priority: 'high',
      estimateHours: 6,
      dueInDays: 5,
      labels: ['frontend', 'cart'],
      subtasks: [
        { title: 'Quantity stepper', done: true },
        { title: 'Subtotal recalculation', done: true },
      ],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'admin@devpor.com',
      createdDaysAgo: 14,
      updatedDaysAgo: 1,
      timeLogs: [{ hours: 5, note: 'Cart controls and edge cases.', daysAgo: 1 }],
    },
    {
      title: 'Integrate payment gateway sandbox',
      description:
        'Connect checkout to the payment gateway sandbox and handle success, decline and timeout responses.',
      status: 'blocked',
      priority: 'critical',
      estimateHours: 14,
      dueInDays: -3,
      labels: ['payments', 'backend'],
      subtasks: [{ title: 'Sandbox credentials', done: false }],
      assigneeEmail: 'raghavshastri@gmail.com',
      reporterEmail: 'admin@devpor.com',
      createdDaysAgo: 16,
      updatedDaysAgo: 4,
    },
    {
      title: 'Send order confirmation email',
      description:
        'Trigger an order confirmation email with the order number, item summary and delivery estimate.',
      status: 'done',
      priority: 'medium',
      estimateHours: 5,
      dueInDays: -8,
      labels: ['email', 'backend'],
      subtasks: [
        { title: 'Email template', done: true },
        { title: 'Order event hook', done: true },
      ],
      assigneeEmail: 'iswarikokankar@gmail.com',
      reporterEmail: 'admin@devpor.com',
      createdDaysAgo: 20,
      updatedDaysAgo: 9,
      timeLogs: [{ hours: 4, note: 'Template and order event wiring.', daysAgo: 10 }],
      clientReview: {
        status: 'approved',
        note: 'Confirmation email content approved.',
        atDaysAgo: 8,
      },
    },
  ],
};

function dateFromNow(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function requireUser(
  users: Map<string, UserDocument>,
  email: string,
): UserDocument {
  const user = users.get(email);

  if (!user) {
    throw new Error(`Demo task user not found: ${email}`);
  }

  return user;
}

function resolveAssignee(
  project: ProjectDocument,
  preferredEmail: string | undefined,
  users: Map<string, UserDocument>,
): Types.ObjectId | null {
  const memberIds = new Set(project.members.map((member) => member.user.toString()));
  const developerEmails = project.members
    .filter((member) => member.role === 'developer')
    .map((member) => member.user.toString());
  const candidates = [
    preferredEmail,
    ...developerEmails.map((id) => usersByEmailInverse(users, id)),
    project.client.toString(),
  ];

  for (const email of candidates) {
    if (!email) {
      continue;
    }

    const user = users.get(email);

    if (user && memberIds.has(user._id.toString())) {
      return user._id;
    }
  }

  return null;
}

function usersByEmailInverse(
  users: Map<string, UserDocument>,
  userId: string,
): string | undefined {
  for (const [email, user] of users) {
    if (user._id.toString() === userId) {
      return email;
    }
  }

  return undefined;
}

function buildClientReview(
  blueprint: DemoTasksBlueprint,
  project: ProjectDocument,
  users: Map<string, UserDocument>,
): TaskClientReviewAttributes {
  const review = blueprint.clientReview;

  if (review) {
    const reviewer = review.byEmail
      ? requireUser(users, review.byEmail)
      : requireUserById(users, project.client.toString());

    return {
      status: review.status,
      note: review.note,
      by: reviewer._id,
      at: dateFromNow(-review.atDaysAgo, 16),
    };
  }

  return {
    status: 'pending',
    note: '',
    by: null,
    at: null,
  };
}

function requireUserById(
  users: Map<string, UserDocument>,
  userId: string,
): UserDocument {
  for (const user of users.values()) {
    if (user._id.toString() === userId) {
      return user;
    }
  }

  throw new Error(`Demo task reviewer not found: ${userId}`);
}

/**
 * Adds realistic project tasks without deleting existing data. Passing
 * `reset: true` clears tasks first, which is used by the full development seed.
 */
export async function seedDemoTasks(
  options: DemoTasksOptions = {},
): Promise<DemoTasksResult> {
  if (options.reset) {
    await Task.deleteMany({});
  }

  const [users, projects] = await Promise.all([User.find(), Project.find()]);
  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const result: DemoTasksResult = { created: 0, skipped: 0, projects: 0 };

  for (const project of projects) {
    const blueprints = DEMO_TASKS[project.title];

    if (!blueprints || blueprints.length === 0) {
      continue;
    }

    result.projects += 1;
    const [requirements, existingTasks] = await Promise.all([
      Requirement.find({ project: project._id }).select('title'),
      Task.find({ project: project._id }).select('title status order'),
    ]);
    const requirementsByTitle = new Map(
      requirements.map((requirement) => [requirement.title, requirement._id]),
    );
    const existingTitles = new Set(existingTasks.map((task) => task.title));
    const orderByStatus = new Map<TaskStatus, number>();

    for (const task of existingTasks) {
      const current = orderByStatus.get(task.status) ?? 0;
      orderByStatus.set(task.status, Math.max(current, task.order + 1));
    }

    for (const blueprint of blueprints) {
      if (existingTitles.has(blueprint.title)) {
        result.skipped += 1;
        continue;
      }

      const reporter = requireUser(usersByEmail, blueprint.reporterEmail);
      const assignee = resolveAssignee(
        project,
        blueprint.assigneeEmail,
        usersByEmail,
      );
      const requirementId = blueprint.requirementTitle
        ? requirementsByTitle.get(blueprint.requirementTitle) ?? null
        : null;
      const order = orderByStatus.get(blueprint.status) ?? 0;
      orderByStatus.set(blueprint.status, order + 1);
      const createdAt = dateFromNow(-blueprint.createdDaysAgo, 9);
      let updatedAt = createdAt;
      const timeLogs: TaskTimeLogAttributes[] = [];

      for (const entry of blueprint.timeLogs ?? []) {
        const user = entry.userEmail
          ? requireUser(usersByEmail, entry.userEmail)
          : (assignee ? requireUserById(usersByEmail, assignee.toString()) : reporter);
        const loggedAt = dateFromNow(-entry.daysAgo, 15);
        timeLogs.push({
          user: user._id,
          hours: entry.hours,
          note: entry.note,
          date: loggedAt,
        });
        if (loggedAt > updatedAt) {
          updatedAt = loggedAt;
        }
      }

      if (
        blueprint.updatedDaysAgo !== undefined &&
        dateFromNow(-blueprint.updatedDaysAgo, 12) > updatedAt
      ) {
        updatedAt = dateFromNow(-blueprint.updatedDaysAgo, 12);
      }

      const task = await Task.create({
        project: project._id,
        requirement: requirementId,
        title: blueprint.title,
        description: blueprint.description,
        assignee,
        reporter: reporter._id,
        status: blueprint.status,
        priority: blueprint.priority,
        estimateHours: blueprint.estimateHours,
        dueDate:
          blueprint.dueInDays === null ? null : dateFromNow(blueprint.dueInDays, 17),
        labels: blueprint.labels,
        order,
        subtasks: blueprint.subtasks satisfies TaskSubtaskAttributes[],
        timeLogs,
        clientReview: buildClientReview(blueprint, project, usersByEmail),
        createdAt,
        updatedAt,
      } satisfies Partial<TaskAttributes>);

      await ActivityLog.create({
        project: project._id,
        actor: reporter._id,
        action: 'task_created',
        entityType: 'task',
        entityId: task._id,
        meta: {
          taskId: task.id,
          title: task.title,
          status: task.status,
          seeded: true,
        },
        createdAt,
      });

      if (blueprint.status !== 'todo') {
        await ActivityLog.create({
          project: project._id,
          actor: assignee ?? reporter._id,
          action: 'task_status_changed',
          entityType: 'task',
          entityId: task._id,
          meta: {
            taskId: task.id,
            title: task.title,
            from: 'todo',
            to: blueprint.status,
          },
          createdAt: updatedAt,
        });
      }

      if (blueprint.clientReview) {
        const reviewer = blueprint.clientReview.byEmail
          ? requireUser(usersByEmail, blueprint.clientReview.byEmail)
          : requireUserById(usersByEmail, project.client.toString());

        await ActivityLog.create({
          project: project._id,
          actor: reviewer._id,
          action: 'task_client_reviewed',
          entityType: 'task',
          entityId: task._id,
          meta: {
            taskId: task.id,
            title: task.title,
            reviewStatus: blueprint.clientReview.status,
            to: blueprint.status,
          },
          createdAt: dateFromNow(-blueprint.clientReview.atDaysAgo, 16),
        });
      }

      result.created += 1;
    }
  }

  return result;
}
