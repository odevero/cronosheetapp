import { GoalEntry, RoadmapItem, TipNote } from '../../domain/entities/models';
import { addCalendarDays, addCalendarMonths, formatIsoDate, parseIsoDate } from '../../domain/services/calendar-duration';

/**
 * Deterministic, date-calibrated seed records relative to `todayIso`
 * following the exact spreadsheet model (Title, Start Date, End Date)
 * with English phrases tailored to "Day X of wanting to ..." and "Wanting to ... for: ...".
 */
export function buildSeedDataset(ownerId: string, todayIso: string): {
  goals: GoalEntry[];
  tips: TipNote[];
  roadmap: RoadmapItem[];
} {
  const nowIso = new Date().toISOString();

  // 1. Exact 1st Anniversary arriving in 2 days
  const inTwoDays = parseIsoDate(addCalendarDays(todayIso, 2))!;
  const oneYearBeforeInTwoDays = formatIsoDate(addCalendarMonths(inTwoDays, -12));

  // 2. Exact 4-month Monthiversary arriving in 1 day
  const tomorrow = parseIsoDate(addCalendarDays(todayIso, 1))!;
  const fourMonthsBeforeTomorrow = formatIsoDate(addCalendarMonths(tomorrow, -4));

  // 3. Exact 100-day Milestone arriving in 3 days
  const hundredDaysTargetStart = addCalendarDays(todayIso, -97);

  // 4. Ongoing project goal (38 days ago)
  const projectStart = addCalendarDays(todayIso, -38);

  // 5. Exact 3-week Weekiversary arriving in 2 days (started 19 days ago)
  const threeWeeksStart = addCalendarDays(todayIso, -19);

  // 6. Completed goal (Start + End)
  const completedStart = addCalendarDays(todayIso, -120);
  const completedEnd = addCalendarDays(todayIso, -28);

  // 7. Future start goal (starts in 12 days)
  const futureStart = addCalendarDays(todayIso, 12);

  const goals: GoalEntry[] = [
    {
      id: 'seed_goal_1',
      ownerId,
      title: 'run 5km every morning',
      startDate: oneYearBeforeInTwoDays,
      endDate: '',
      notes: '',
      sortOrder: 0,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_goal_2',
      ownerId,
      title: 'master Clean Architecture & TypeScript',
      startDate: fourMonthsBeforeTomorrow,
      endDate: '',
      notes: '',
      sortOrder: 1,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_goal_3',
      ownerId,
      title: 'stay sugar-free for 100 days',
      startDate: hundredDaysTargetStart,
      endDate: '',
      notes: '',
      sortOrder: 2,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_goal_4',
      ownerId,
      title: 'publish CronoSheet on GitHub',
      startDate: projectStart,
      endDate: '',
      notes: '',
      sortOrder: 3,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_goal_5',
      ownerId,
      title: 'read 20 pages daily',
      startDate: threeWeeksStart,
      endDate: '',
      notes: '',
      sortOrder: 4,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_goal_6',
      ownerId,
      title: 'pass Cloud Fundamentals exam',
      startDate: completedStart,
      endDate: completedEnd,
      notes: '',
      sortOrder: 5,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_goal_7',
      ownerId,
      title: 'run a spring half marathon',
      startDate: futureStart,
      endDate: '',
      notes: '',
      sortOrder: 6,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
  ];

  const tips: TipNote[] = [
    {
      id: 'seed_tip_1',
      ownerId,
      goalId: 'seed_goal_4',
      nextStep: 'Scrivere README con diagramma Clean Architecture (domain/usecases/adapters/main) e badge test.',
      done: false,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_tip_2',
      ownerId,
      goalId: 'seed_goal_1',
      nextStep: 'Pianificare uscita celebrativa di 10 km nel giorno del 1° anniversario.',
      done: false,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_tip_3',
      ownerId,
      goalId: 'seed_goal_2',
      nextStep: 'Completare i test unitari sui casi limite del 29 febbraio e del 31 gennaio.',
      done: true,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
  ];

  // Preserves the exact two backlog items from the user's uploaded NEXT sheet CSV
  const roadmap: RoadmapItem[] = [
    {
      id: 'seed_next_1',
      ownerId,
      text: 'correggere il conteggio di anni, mesi, settimane e giorni',
      done: true,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_next_2',
      ownerId,
      text: 'collegare un modulo per input dati + trasferire i dati inseriti dal modulo alla scheda Personal',
      done: true,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'seed_next_3',
      ownerId,
      text: 'attivare 2FA con Google Authenticator e collegare il repository su GitHub',
      done: false,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
  ];

  return { goals, tips, roadmap };
}
