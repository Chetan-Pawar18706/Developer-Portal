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
import { User, hashPassword, type UserDocument, type UserRole } from '../models/user.model';

interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
  password: string;
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
  activity: SeedActivity[];
}

const seedUsers: readonly SeedUser[] = [
  {
    name: 'DevPortal Admin',
    email: 'admin@devpor.com',
    role: 'admin',
    password: 'Admin@123',
  },
  {
    name: 'Chetan Pawar',
    email: 'chetanpawar18706@gmail.com',
    role: 'pm',
    password: 'Chetan@123',
  },
  {
    name: 'Raghav Shastri',
    email: 'raghavshastri@gmail.com',
    role: 'developer',
    password: 'raghav@123',
  },
  {
    name: 'Ishwari Kokankar',
    email: 'iswarikokankar@gmail.com',
    role: 'developer',
    password: 'ishwari@123',
  },
  {
    name: 'Nikhil Sury',
    email: 'nikhilsury@gmail.com',
    role: 'client',
    password: 'nikhil@123',
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

async function seed(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production.');
    process.exit(1);
  }

  try {
    await connectDatabase();

    await ActivityLog.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});

    const createdUsers = await User.insertMany(
      await Promise.all(
        seedUsers.map(async (user) => ({
          name: user.name,
          email: user.email,
          role: user.role,
          passwordHash: await hashPassword(user.password),
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

    console.log(`Seeded ${createdUsers.length} users and ${createdProjects.length} projects.`);
    console.log('\nDemo accounts:');

    for (const user of seedUsers) {
      console.log(`  ${user.role.padEnd(10)} ${user.email.padEnd(34)} ${user.password}`);
    }

    console.log('\nProjects:');

    for (const project of createdProjects) {
      console.log(`  ${project.title} (${project.id})`);
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void seed();
