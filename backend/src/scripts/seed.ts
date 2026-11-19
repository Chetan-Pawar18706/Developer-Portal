import type { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import {
  ActivityLog,
  type ActivityAction,
  type ActivityEntityType,
} from '../models/activityLog.model';
import {
  Project,
  type ProjectHealth,
  type ProjectPriority,
  type ProjectStatus,
} from '../models/project.model';
import {
  Requirement,
  type RequirementPriority,
  type RequirementStatus,
  type RequirementType,
} from '../models/requirement.model';
import { Task } from '../models/task.model';
import { User, hashPassword, type UserDocument, type UserRole } from '../models/user.model';
import { seedDemoTasks } from './demo-tasks';

interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  website?: string;
  github?: string;
  linkedin?: string;
}

interface SeedMember {
  email: string;
  role: UserRole;
}

interface SeedActivity {
  actorEmail: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  daysAgo: number;
  meta?: Record<string, unknown>;
}

interface SeedSignOff {
  signedDaysAgo: number;
  note: string;
  rating: number;
  feedback: string;
}

interface SeedRequirement {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: RequirementPriority;
  type: RequirementType;
  status: RequirementStatus;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  createdByEmail: string;
  editedByEmail?: string;
  editedDaysAgo?: number;
  originalDescription?: string;
  reviewNote?: string;
  changeRequestOf?: string;
}

interface SeedProject {
  title: string;
  description: string;
  clientEmail: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  health: ProjectHealth;
  budget: number;
  tags: string[];
  createdDaysAgo: number;
  startInDays: number | null;
  dueInDays: number | null;
  members: SeedMember[];
  signOff?: SeedSignOff;
  requirements: SeedRequirement[];
  activity: SeedActivity[];
}

function demoPassword(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const seedUsers: readonly SeedUser[] = [
  {
    name: 'DevPortal Admin',
    email: 'admin@devpor.com',
    role: 'admin',
    password: demoPassword('SEED_ADMIN_PASSWORD', 'Admin@123'),
  },
  {
    name: 'Chetan Pawar',
    email: 'chetanpawar18706@gmail.com',
    role: 'pm',
    password: demoPassword('SEED_PM_PASSWORD', 'Chetan@123'),
    jobTitle: 'Project Manager',
    company: 'DevPortal Studio',
    location: 'Pune, India',
    bio: 'I coordinate delivery, remove blockers and keep clients aligned with the team.',
    skills: ['Planning', 'Delivery management', 'Stakeholder communication'],
    linkedin: 'chetan-pawar',
  },
  {
    name: 'Raghav Shastri',
    email: 'raghavshastri@gmail.com',
    role: 'developer',
    password: demoPassword('SEED_DEVELOPER_PASSWORD', 'raghav@123'),
    jobTitle: 'Senior Full-stack Developer',
    company: 'DevPortal Studio',
    location: 'Pune, India',
    bio: 'I build Angular and Node.js features with a focus on clean APIs and reliable delivery.',
    skills: ['Angular', 'Node.js', 'TypeScript', 'MongoDB'],
    website: 'https://example.com/raghav',
    github: 'raghavshastri',
    linkedin: 'raghav-shastri',
  },
  {
    name: 'Ishwari Kokankar',
    email: 'iswarikokankar@gmail.com',
    role: 'developer',
    password: demoPassword('SEED_DEVELOPER_PASSWORD', 'ishwari@123'),
    jobTitle: 'Frontend Developer',
    company: 'DevPortal Studio',
    location: 'Mumbai, India',
    bio: 'I turn requirements into accessible, responsive Angular interfaces.',
    skills: ['Angular', 'SCSS', 'Accessibility'],
    github: 'ishwari-k',
  },
  {
    name: 'Nikhil Sury',
    email: 'nikhilsury@gmail.com',
    role: 'client',
    password: demoPassword('SEED_CLIENT_PASSWORD', 'nikhil@123'),
    jobTitle: 'Product Owner',
    company: 'Northwind Retail',
    location: 'Bengaluru, India',
    bio: 'I own the product vision and review delivered work with the development team.',
    skills: ['Product strategy', 'Acceptance testing'],
    linkedin: 'nikhil-sury',
  },
];

const seedProjects: readonly SeedProject[] = [
  {
    title: 'Customer Portal Redesign',
    description:
      'Redesign the customer-facing portal with a faster account dashboard, clearer billing history and a responsive support journey. The engagement covers UX discovery, Angular implementation and a staged rollout.',
    clientEmail: 'nikhilsury@gmail.com',
    status: 'active',
    priority: 'high',
    health: 'on_track',
    budget: 850000,
    tags: ['Angular', 'UX design', 'Customer portal'],
    createdDaysAgo: 74,
    startInDays: -68,
    dueInDays: 46,
    members: [
      { email: 'nikhilsury@gmail.com', role: 'client' },
      { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      { email: 'raghavshastri@gmail.com', role: 'developer' },
      { email: 'iswarikokankar@gmail.com', role: 'developer' },
    ],
    requirements: [
      {
        title: 'Password reset and account recovery',
        description:
          '<p>Customers can request a secure password reset link from the sign-in page. The reset link must expire automatically and invalidate all other active sessions after the password changes.</p>',
        acceptanceCriteria: [
          'A reset email is delivered within one minute',
          'Reset links expire after 30 minutes and can only be used once',
          'Changing the password invalidates other active sessions',
        ],
        priority: 'must',
        type: 'functional',
        status: 'approved',
        createdDaysAgo: 66,
        updatedDaysAgo: 58,
        createdByEmail: 'nikhilsury@gmail.com',
        editedByEmail: 'chetanpawar18706@gmail.com',
        editedDaysAgo: 60,
        originalDescription:
          '<p>Customers need a way to reset their password from the portal sign-in page.</p>',
        reviewNote: 'Approved after the security review confirmed link expiry and session invalidation.',
      },
      {
        title: 'Invoice history and PDF downloads',
        description:
          '<p>The billing area lists every invoice with its issue date, amount and payment status. Customers can download an accessible PDF copy of any invoice from the current or previous billing periods.</p>',
        acceptanceCriteria: [
          'Invoices are listed newest first with status visible',
          'PDF downloads use the authenticated customer session',
          'Empty billing history shows a helpful explanation',
        ],
        priority: 'should',
        type: 'functional',
        status: 'under_review',
        createdDaysAgo: 24,
        updatedDaysAgo: 21,
        createdByEmail: 'nikhilsury@gmail.com',
        editedByEmail: 'nikhilsury@gmail.com',
        editedDaysAgo: 22,
      },
      {
        title: 'Support ticket status visibility',
        description:
          '<p>Customers can see the current status of their support tickets without leaving the portal. The view should explain what each status means and when the customer can expect a response.</p>',
        acceptanceCriteria: [
          'Open, in progress, waiting on customer and resolved states are explained',
          'Only tickets owned by the signed-in customer are shown',
        ],
        priority: 'could',
        type: 'functional',
        status: 'clarification',
        createdDaysAgo: 19,
        updatedDaysAgo: 16,
        createdByEmail: 'nikhilsury@gmail.com',
        reviewNote: 'Please clarify which ticket fields and timestamps should be visible to customers.',
      },
    ],
    activity: [
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'project_created',
        entityType: 'project',
        daysAgo: 74,
        meta: { title: 'Customer Portal Redesign', status: 'draft' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 73,
        meta: { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 72,
        meta: { email: 'raghavshastri@gmail.com', role: 'developer' },
      },
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 70,
        meta: { from: 'draft', to: 'submitted' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 66,
        meta: { from: 'submitted', to: 'active' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 60,
        meta: { email: 'iswarikokankar@gmail.com', role: 'developer' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 28,
        meta: { from: 'active', to: 'on_hold' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 21,
        meta: { from: 'on_hold', to: 'active' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'project_updated',
        entityType: 'project',
        daysAgo: 14,
        meta: { fields: ['dueDate', 'priority'] },
      },
    ],
  },
  {
    title: 'Mobile Checkout Revamp',
    description:
      'Streamline the mobile checkout with saved payment methods, address validation and a two-step confirmation flow. The goal is to reduce abandonment on low-bandwidth connections while keeping the experience accessible.',
    clientEmail: 'nikhilsury@gmail.com',
    status: 'submitted',
    priority: 'critical',
    health: 'at_risk',
    budget: 420000,
    tags: ['Mobile', 'Payments', 'Conversion'],
    createdDaysAgo: 12,
    startInDays: 7,
    dueInDays: 72,
    members: [
      { email: 'nikhilsury@gmail.com', role: 'client' },
      { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      { email: 'raghavshastri@gmail.com', role: 'developer' },
    ],
    requirements: [
      {
        title: 'Saved payment methods at checkout',
        description:
          '<p>Returning customers can select a saved payment method without re-entering card details. New customers can opt in to save a payment method after a successful purchase.</p>',
        acceptanceCriteria: [
          'Saved cards show the brand and last four digits only',
          'Customers can remove a saved payment method',
          'Saving a method requires explicit consent',
        ],
        priority: 'must',
        type: 'functional',
        status: 'submitted',
        createdDaysAgo: 10,
        updatedDaysAgo: 9,
        createdByEmail: 'nikhilsury@gmail.com',
      },
      {
        title: 'Low-bandwidth checkout performance',
        description:
          '<p>The complete checkout journey remains usable on a slow mobile connection. Product images and non-critical assets load after the payment form is interactive.</p>',
        acceptanceCriteria: [
          'The payment form becomes interactive within three seconds on a throttled connection',
          'Checkout can complete without loading decorative images',
          'Failed asset requests do not block payment',
        ],
        priority: 'should',
        type: 'non_functional',
        status: 'draft',
        createdDaysAgo: 8,
        updatedDaysAgo: 8,
        createdByEmail: 'nikhilsury@gmail.com',
      },
    ],
    activity: [
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'project_created',
        entityType: 'project',
        daysAgo: 12,
        meta: { title: 'Mobile Checkout Revamp', status: 'draft' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 11,
        meta: { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 10,
        meta: { email: 'raghavshastri@gmail.com', role: 'developer' },
      },
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 2,
        meta: { from: 'draft', to: 'submitted' },
      },
    ],
  },
  {
    title: 'Inventory Sync Service',
    description:
      'Build a resilient integration between the warehouse system and the online storefront. The service will batch stock updates, reconcile mismatches and expose a health endpoint for the operations team.',
    clientEmail: 'nikhilsury@gmail.com',
    status: 'on_hold',
    priority: 'medium',
    health: 'off_track',
    budget: 610000,
    tags: ['API', 'Integrations', 'Node.js'],
    createdDaysAgo: 96,
    startInDays: -90,
    dueInDays: 12,
    members: [
      { email: 'nikhilsury@gmail.com', role: 'client' },
      { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      { email: 'iswarikokankar@gmail.com', role: 'developer' },
    ],
    requirements: [
      {
        title: 'Batch stock updates every five minutes',
        description:
          '<p>The integration collects stock changes from the warehouse system and publishes them to the storefront in batches. Duplicate updates are ignored and failed batches retry with backoff.</p>',
        acceptanceCriteria: [
          'Stock updates are visible within five minutes of the warehouse change',
          'Duplicate events do not change the final stock count',
          'Failed batches retry without dropping later updates',
        ],
        priority: 'must',
        type: 'non_functional',
        status: 'approved',
        createdDaysAgo: 88,
        updatedDaysAgo: 82,
        createdByEmail: 'nikhilsury@gmail.com',
        editedByEmail: 'chetanpawar18706@gmail.com',
        editedDaysAgo: 84,
        originalDescription:
          '<p>Stock changes need to move from the warehouse to the storefront regularly.</p>',
        reviewNote: 'Approved with the five-minute freshness target and retry policy.',
      },
      {
        title: 'Mismatch reconciliation report',
        description:
          '<p>Operations can review stock mismatches between the warehouse and storefront, with filters for SKU, location and last sync time.</p>',
        acceptanceCriteria: [
          'Mismatches are grouped by SKU and location',
          'The report shows when each record was last reconciled',
          'Operations can export the current mismatch list',
        ],
        priority: 'should',
        type: 'functional',
        status: 'clarification',
        createdDaysAgo: 32,
        updatedDaysAgo: 27,
        createdByEmail: 'nikhilsury@gmail.com',
        reviewNote: 'Which export format and date range should the operations team use?',
      },
    ],
    activity: [
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'project_created',
        entityType: 'project',
        daysAgo: 96,
        meta: { title: 'Inventory Sync Service', status: 'draft' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 95,
        meta: { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 94,
        meta: { email: 'iswarikokankar@gmail.com', role: 'developer' },
      },
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 90,
        meta: { from: 'draft', to: 'submitted' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 86,
        meta: { from: 'submitted', to: 'active' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'project_updated',
        entityType: 'project',
        daysAgo: 18,
        meta: { health: 'off_track' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 16,
        meta: { from: 'active', to: 'on_hold' },
      },
    ],
  },
  {
    title: 'Reporting & Analytics Dashboard',
    description:
      'Deliver an executive reporting dashboard with revenue trends, delivery performance and client satisfaction charts. The engagement includes data modelling, role-specific views and a completed UAT cycle.',
    clientEmail: 'nikhilsury@gmail.com',
    status: 'completed',
    priority: 'high',
    health: 'on_track',
    budget: 975000,
    tags: ['Analytics', 'Charts', 'Data'],
    createdDaysAgo: 170,
    startInDays: -160,
    dueInDays: -12,
    members: [
      { email: 'nikhilsury@gmail.com', role: 'client' },
      { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      { email: 'raghavshastri@gmail.com', role: 'developer' },
      { email: 'iswarikokankar@gmail.com', role: 'developer' },
    ],
    requirements: [
      {
        title: 'Executive revenue trend dashboard',
        description:
          '<p>Executives can review monthly revenue trends, compare targets and drill into the client accounts driving the largest changes.</p>',
        acceptanceCriteria: [
          'Revenue trends load for the selected rolling twelve-month period',
          'Target and actual values are visually distinct',
          'Selecting a month filters the contributing client accounts',
        ],
        priority: 'must',
        type: 'functional',
        status: 'approved',
        createdDaysAgo: 156,
        updatedDaysAgo: 144,
        createdByEmail: 'nikhilsury@gmail.com',
        editedByEmail: 'chetanpawar18706@gmail.com',
        editedDaysAgo: 150,
        originalDescription:
          '<p>Executives need a dashboard that shows revenue over time.</p>',
        reviewNote: 'Approved after the finance team validated the target calculation.',
      },
      {
        title: 'Export dashboard data to CSV',
        description:
          '<p>Every dashboard chart supports a CSV export of the currently filtered dataset, including the selected date range and comparison period.</p>',
        acceptanceCriteria: [
          'Exports match the filters currently applied on screen',
          'CSV files include readable column headings and ISO dates',
          'Large exports show progress and do not block other dashboard actions',
        ],
        priority: 'should',
        type: 'functional',
        status: 'approved',
        createdDaysAgo: 130,
        updatedDaysAgo: 118,
        createdByEmail: 'nikhilsury@gmail.com',
        reviewNote: 'Approved after the export format matched the finance reporting template.',
      },
      {
        title: 'Change request: quarterly revenue comparison',
        description:
          '<p>Add a quarterly comparison view to the revenue dashboard so leadership can compare the current quarter against the previous four quarters.</p>',
        acceptanceCriteria: [
          'The comparison view groups revenue by fiscal quarter',
          'The previous four quarters are available as comparison baselines',
          'The existing monthly trend view remains unchanged',
        ],
        priority: 'should',
        type: 'functional',
        status: 'draft',
        createdDaysAgo: 5,
        updatedDaysAgo: 5,
        createdByEmail: 'nikhilsury@gmail.com',
        changeRequestOf: 'Executive revenue trend dashboard',
      },
    ],
    signOff: {
      signedDaysAgo: 8,
      note: 'Accepted after the final UAT round. The team delivered the requested executive views and export flow.',
      rating: 5,
      feedback:
        'Clear communication throughout delivery. The dashboard is already saving our leadership team time.',
    },
    activity: [
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'project_created',
        entityType: 'project',
        daysAgo: 170,
        meta: { title: 'Reporting & Analytics Dashboard', status: 'draft' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 168,
        meta: { email: 'chetanpawar18706@gmail.com', role: 'pm' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 166,
        meta: { email: 'raghavshastri@gmail.com', role: 'developer' },
      },
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 164,
        meta: { from: 'draft', to: 'submitted' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 158,
        meta: { from: 'submitted', to: 'active' },
      },
      {
        actorEmail: 'chetanpawar18706@gmail.com',
        action: 'member_added',
        entityType: 'member',
        daysAgo: 140,
        meta: { email: 'iswarikokankar@gmail.com', role: 'developer' },
      },
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'status_changed',
        entityType: 'status',
        daysAgo: 8,
        meta: { from: 'active', to: 'completed', signedOff: true },
      },
    ],
  },
  {
    title: 'Vendor Onboarding Workflow',
    description:
      'Map the vendor onboarding process and replace the current spreadsheet handoffs with a guided workflow. This is the first draft of the brief and is awaiting internal review before submission.',
    clientEmail: 'nikhilsury@gmail.com',
    status: 'draft',
    priority: 'low',
    health: 'on_track',
    budget: 280000,
    tags: ['Workflow', 'Operations'],
    createdDaysAgo: 2,
    startInDays: 14,
    dueInDays: 90,
    members: [{ email: 'nikhilsury@gmail.com', role: 'client' }],
    requirements: [
      {
        title: 'Guided vendor application form',
        description:
          '<p>New vendors complete a guided application with company details, tax information and supporting documents. Progress is saved between sessions.</p>',
        acceptanceCriteria: [
          'Applicants can save and resume a partially completed application',
          'Required fields are validated as the vendor moves between steps',
          'Uploaded documents show file name, type and size',
        ],
        priority: 'should',
        type: 'functional',
        status: 'draft',
        createdDaysAgo: 2,
        updatedDaysAgo: 2,
        createdByEmail: 'nikhilsury@gmail.com',
      },
    ],
    activity: [
      {
        actorEmail: 'nikhilsury@gmail.com',
        action: 'project_created',
        entityType: 'project',
        daysAgo: 2,
        meta: { title: 'Vendor Onboarding Workflow', status: 'draft' },
      },
    ],
  },
];

function dateFromNow(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function previousRequirementStatus(status: RequirementStatus): RequirementStatus {
  switch (status) {
    case 'submitted':
      return 'draft';
    case 'under_review':
      return 'submitted';
    case 'approved':
    case 'clarification':
    case 'rejected':
      return 'under_review';
    default:
      return 'draft';
  }
}

async function seed(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production.');
    process.exit(1);
  }

  try {
    await connectDatabase();

    await ActivityLog.deleteMany({});
    await Task.deleteMany({});
    await Requirement.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});

    const createdUsers = await User.insertMany(
      await Promise.all(
        seedUsers.map(async (user) => ({
          name: user.name,
          email: user.email,
          role: user.role,
          passwordHash: await hashPassword(user.password),
          jobTitle: user.jobTitle ?? null,
          company: user.company ?? null,
          location: user.location ?? null,
          bio: user.bio ?? null,
          skills: user.skills ?? [],
          website: user.website ?? null,
          github: user.github ?? null,
          linkedin: user.linkedin ?? null,
        })),
      ),
    );

    const usersByEmail = new Map(createdUsers.map((user) => [user.email, user]));

    function requireUser(email: string): UserDocument {
      const user = usersByEmail.get(email);

      if (!user) {
        throw new Error(`Seed user not found: ${email}`);
      }

      return user;
    }

    const createdProjects: Array<{ id: string; title: string }> = [];
    const createdRequirements: Array<{
      id: string;
      title: string;
      project: string;
      status: RequirementStatus;
    }> = [];

    for (const seedProject of seedProjects) {
      const client = requireUser(seedProject.clientEmail);
      const createdAt = dateFromNow(-seedProject.createdDaysAgo, 9);
      const lastActivityDaysAgo = Math.min(
        ...seedProject.activity.map((activity) => activity.daysAgo),
      );
      const signedAt = seedProject.signOff
        ? dateFromNow(-seedProject.signOff.signedDaysAgo, 15)
        : null;

      const project = await Project.create({
        title: seedProject.title,
        description: seedProject.description,
        client: client._id,
        status: seedProject.status,
        priority: seedProject.priority,
        health: seedProject.health,
        budget: seedProject.budget,
        tags: seedProject.tags,
        startDate:
          seedProject.startInDays === null ? null : dateFromNow(seedProject.startInDays, 9),
        dueDate: seedProject.dueInDays === null ? null : dateFromNow(seedProject.dueInDays, 17),
        members: seedProject.members.map((member) => ({
          user: requireUser(member.email)._id,
          role: member.role,
        })),
        deliverySignOff: {
          signedBy: seedProject.signOff ? client._id : null,
          signedAt,
          note: seedProject.signOff?.note ?? '',
          rating: seedProject.signOff?.rating ?? null,
          feedback: seedProject.signOff?.feedback ?? '',
        },
        createdAt,
        updatedAt: signedAt ?? dateFromNow(-lastActivityDaysAgo, 12),
      });

      createdProjects.push({ id: project.id, title: project.title });

      const requirementsByTitle = new Map<
        string,
        { id: string; documentId: Types.ObjectId; title: string }
      >();

      for (const seedRequirement of seedProject.requirements) {
        const creator = requireUser(seedRequirement.createdByEmail);
        const createdAt = dateFromNow(-seedRequirement.createdDaysAgo, 11);
        const updatedAt = dateFromNow(-seedRequirement.updatedDaysAgo, 15);
        const source = seedRequirement.changeRequestOf
          ? requirementsByTitle.get(seedRequirement.changeRequestOf)
          : undefined;

        if (seedRequirement.changeRequestOf && !source) {
          throw new Error(
            `Seed change request source not found: ${seedRequirement.changeRequestOf}`,
          );
        }

        const versions = [
          {
            title: seedRequirement.title,
            description:
              seedRequirement.originalDescription ?? seedRequirement.description,
            editedBy: creator._id,
            editedAt: createdAt,
          },
        ];

        if (seedRequirement.editedByEmail) {
          versions.push({
            title: seedRequirement.title,
            description: seedRequirement.description,
            editedBy: requireUser(seedRequirement.editedByEmail)._id,
            editedAt: dateFromNow(
              -(seedRequirement.editedDaysAgo ?? seedRequirement.updatedDaysAgo),
              14,
            ),
          });
        }

        const requirement = await Requirement.create({
          project: project._id,
          title: seedRequirement.title,
          description: seedRequirement.description,
          acceptanceCriteria: seedRequirement.acceptanceCriteria,
          priority: seedRequirement.priority,
          type: seedRequirement.type,
          status: seedRequirement.status,
          versions,
          attachments: [],
          createdBy: creator._id,
          reviewNote: seedRequirement.reviewNote ?? '',
          changeRequestOf: source?.documentId ?? null,
          createdAt,
          updatedAt,
        });

        requirementsByTitle.set(requirement.title, {
          id: requirement.id,
          documentId: requirement._id,
          title: requirement.title,
        });
        createdRequirements.push({
          id: requirement.id,
          title: requirement.title,
          project: project.title,
          status: requirement.status,
        });

        await ActivityLog.create({
          project: project._id,
          actor: creator._id,
          action: 'requirement_created',
          entityType: 'requirement',
          entityId: requirement._id,
          meta: {
            requirementId: requirement.id,
            title: requirement.title,
            status: requirement.status,
          },
          createdAt,
        });

        if (requirement.status !== 'draft') {
          await ActivityLog.create({
            project: project._id,
            actor:
              requirement.status === 'submitted'
                ? creator._id
                : requireUser('chetanpawar18706@gmail.com')._id,
            action: 'requirement_status_changed',
            entityType: 'requirement',
            entityId: requirement._id,
            meta: {
              requirementId: requirement.id,
              title: requirement.title,
              from: previousRequirementStatus(requirement.status),
              to: requirement.status,
              ...(seedRequirement.reviewNote
                ? { note: seedRequirement.reviewNote }
                : {}),
            },
            createdAt: updatedAt,
          });
        }

        if (source) {
          await ActivityLog.create({
            project: project._id,
            actor: creator._id,
            action: 'requirement_change_requested',
            entityType: 'requirement',
            entityId: requirement._id,
            meta: {
              requirementId: requirement.id,
              sourceRequirementId: source.id,
              sourceTitle: source.title,
              title: requirement.title,
            },
            createdAt,
          });
        }
      }

      if (seedProject.activity.length > 0) {
        await ActivityLog.insertMany(
          seedProject.activity.map((activity, index) => ({
            project: project._id,
            actor: requireUser(activity.actorEmail)._id,
            action: activity.action,
            entityType: activity.entityType,
            entityId: project._id as Types.ObjectId,
            meta: activity.meta ?? {},
            createdAt: dateFromNow(-activity.daysAgo, 9 + (index % 8)),
          })),
        );
      }
    }

    const taskResult = await seedDemoTasks();

    console.log(
      `Seeded ${createdUsers.length} users, ${createdProjects.length} projects, ${createdRequirements.length} requirements and ${taskResult.created} tasks.`,
    );
    console.log('\nDemo accounts:');

    for (const user of seedUsers) {
      console.log(`  ${user.role.padEnd(10)} ${user.email}`);
    }

    console.log('\nProjects:');

    for (const project of createdProjects) {
      console.log(`  ${project.title} (${project.id})`);
    }

    console.log('\nRequirements:');

    for (const requirement of createdRequirements) {
      console.log(
        `  ${requirement.project} · ${requirement.title} (${requirement.status}, ${requirement.id})`,
      );
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void seed();
