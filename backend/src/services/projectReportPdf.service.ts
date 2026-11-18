import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import { Issue, ISSUE_STATUSES } from '../models/issue.model';
import { Project } from '../models/project.model';
import { Task } from '../models/task.model';
import { ApiError } from '../utils/ApiError';
import { getProjectDashboard } from './dashboard.service';

const OPEN_STATUSES = ISSUE_STATUSES.filter(
  (status) => status !== 'resolved' && status !== 'closed',
);
const PAGE_BOTTOM = 720;
const ROW_HEIGHT = 18;

function label(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString('en-GB');
  }

  return String(value);
}

export async function buildProjectReportPdf(projectId: string): Promise<Buffer> {
  const objectId = new Types.ObjectId(projectId);
  const project = await Project.findById(objectId).select('title description health dueDate');

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  const [dashboard, tasks, issues] = await Promise.all([
    getProjectDashboard(projectId),
    Task.find({ project: objectId })
      .select('title status assignee dueDate estimateHours')
      .populate('assignee', 'name')
      .sort({ status: 1, title: 1 })
      .lean(),
    Issue.find({ project: objectId, status: { $in: OPEN_STATUSES } })
      .select('title severity status createdAt')
      .sort({ severity: -1, createdAt: 1 })
      .lean(),
  ]);

  const doc = new PDFDocument({ margin: 45, size: 'A4' });
  const chunks: Buffer[] = [];

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = 45;
    const ensureSpace = (height: number): void => {
      if (y + height > PAGE_BOTTOM) {
        doc.addPage();
        y = 45;
      }
    };
    const writeLine = (value: string, fontSize = 10, bold = false): void => {
      ensureSpace(fontSize + 6);
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(value, 45, y, { width: 505 });
      y = doc.y + 4;
    };

    doc.font('Helvetica-Bold').fontSize(20).text('Delivery Report', 45, y);
    y = doc.y + 6;
    writeLine(project.title, 14, true);
    writeLine(`Generated ${text(new Date())}  |  Health: ${label(project.health)}`);
    writeLine(`Due date: ${text(project.dueDate)}`);
    y += 6;

    doc.moveTo(45, y).lineTo(550, y).strokeColor('#cbd5e1').stroke();
    y += 12;

    writeLine('Summary', 13, true);
    const statusSummary = dashboard.tasks.byStatus
      .filter((item) => item.count > 0)
      .map((item) => `${label(item.key)}: ${item.count}`)
      .join('   ');
    writeLine(`Tasks: ${dashboard.tasks.total}  |  ${statusSummary || 'No tasks'}`);
    writeLine(
      `Completion: ${dashboard.tasks.completionPercent}%  |  Overdue: ${dashboard.tasks.overdue}`,
    );
    writeLine(
      `Hours: ${dashboard.tasks.hoursLogged} logged of ${dashboard.tasks.hoursEstimated} estimated`,
    );
    writeLine(`Open issues: ${issues.length}  |  Pending approvals: ${dashboard.pendingApprovals.total}`);
    y += 8;

    writeLine('Task table', 13, true);
    const columns = [
      { title: 'Task', x: 45, width: 210 },
      { title: 'Status', x: 260, width: 95 },
      { title: 'Assignee', x: 360, width: 105 },
      { title: 'Due', x: 470, width: 80 },
    ];

    const drawHeader = (): void => {
      ensureSpace(ROW_HEIGHT + 6);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
      for (const column of columns) {
        doc.text(column.title, column.x, y, { width: column.width, lineBreak: false });
      }
      y += ROW_HEIGHT;
      doc.moveTo(45, y).lineTo(550, y).strokeColor('#cbd5e1').stroke();
      y += 4;
    };

    drawHeader();
    doc.fillColor('#000000');

    if (tasks.length === 0) {
      writeLine('No tasks have been created for this project.');
    } else {
      for (const task of tasks) {
        ensureSpace(ROW_HEIGHT + 4);
        const assignee = task.assignee as unknown as { name?: string } | Types.ObjectId | null;
        const assigneeName =
          assignee && !(assignee instanceof Types.ObjectId) ? assignee.name ?? '—' : '—';
        const values = [
          task.title,
          label(task.status),
          assigneeName,
          text(task.dueDate),
        ];
        doc.font('Helvetica').fontSize(9);
        values.forEach((value, index) => {
          const column = columns[index];
          if (column) {
            doc.text(value, column.x, y, {
              width: column.width,
              lineBreak: false,
              ellipsis: true,
            });
          }
        });
        y += ROW_HEIGHT;
        doc.moveTo(45, y).lineTo(550, y).strokeColor('#e2e8f0').stroke();
        y += 3;
      }
    }

    y += 10;
    writeLine('Open issues', 13, true);

    if (issues.length === 0) {
      writeLine('No open issues.');
    } else {
      for (const issue of issues) {
        writeLine(
          `${label(issue.severity)} · ${label(issue.status)} — ${issue.title}`,
          9,
        );
      }
    }

    doc.end();
  });

  return buffer;
}
