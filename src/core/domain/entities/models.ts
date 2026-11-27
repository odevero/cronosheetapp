export type GooglePaletteColor = 'blue' | 'red' | 'yellow' | 'green';

export interface GooglePaletteStyle {
  readonly color: GooglePaletteColor;
  readonly hex: string;
  readonly rowBgClass: string;
  readonly rowHoverClass: string;
  readonly inkClass: string;
  readonly softBgClass: string;
  readonly borderClass: string;
}

export interface GoalEntry {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly startDate: string; // YYYY-MM-DD or ''
  readonly endDate: string; // YYYY-MM-DD or ''
  readonly notes: string;
  readonly sortOrder: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface GoalInput {
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly notes: string;
}

export interface DurationBreakdown {
  readonly years: number;
  readonly months: number;
  readonly weeks: number;
  readonly days: number;
  readonly totalDays: number;
  readonly direction: 'past' | 'future' | 'today';
}

export type DateScenario =
  | 'NO_DATES'
  | 'ONGOING'
  | 'FUTURE_START'
  | 'COMPLETED'
  | 'END_ONLY';

export interface ComputedGoalMetrics {
  readonly scenario: DateScenario;
  readonly isCompleted: boolean;
  readonly primaryDays: number | null;
  readonly signedDays: number | null;
  readonly breakdown: DurationBreakdown | null;
  readonly formattedYmw: string;
  readonly compactYmw: string;
  readonly shareDaysMessage: string;
  readonly shareYmwMessage: string;
  readonly debugFormulaTrace: string;
}

export interface EnrichedGoal {
  readonly goal: GoalEntry;
  readonly rowIndex: number; // 1-based sheet row
  readonly palette: GooglePaletteStyle;
  readonly metrics: ComputedGoalMetrics;
}

export type RecurrenceType = 'anniversary' | 'monthiversary' | 'weekiversary' | 'milestone';

export interface RecurrenceThresholds {
  readonly anniversaryDays: number;
  readonly monthiversaryDays: number;
  readonly weekiversaryDays: number;
  readonly milestoneDays: number;
}

export interface RecurrenceMatch {
  readonly id: string;
  readonly goalId: string;
  readonly goalTitle: string;
  readonly startDate: string;
  readonly recurrenceDate: string;
  readonly daysUntil: number; // 0 = today
  readonly type: RecurrenceType;
  readonly label: string;
  readonly exactBreakdown: DurationBreakdown;
  readonly palette: GooglePaletteStyle;
}

export interface RecurrenceCompartments {
  readonly anniversaries: readonly RecurrenceMatch[];
  readonly monthiversaries: readonly RecurrenceMatch[];
  readonly weekiversaries: readonly RecurrenceMatch[];
  readonly milestones: readonly RecurrenceMatch[];
  readonly totalCount: number;
}

export interface TipNote {
  readonly id: string;
  readonly ownerId: string;
  readonly goalId: string;
  readonly nextStep: string;
  readonly done: boolean;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface TipInput {
  readonly goalId: string;
  readonly nextStep: string;
}

export interface RoadmapItem {
  readonly id: string;
  readonly ownerId: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface UserProfile {
  readonly ownerId: string;
  readonly displayName: string;
  readonly paletteStartRow: number; // 1..4+ offset
  readonly thresholds: RecurrenceThresholds;
}

export interface UserMfaSecurity {
  readonly ownerId: string;
  readonly totpEnabled: boolean;
  readonly totpSecret: string;
  readonly backupCodeHashes: readonly string[];
  readonly enrolledAtIso: string | null;
}

export interface UserEncryptionSecurity {
  readonly ownerId: string;
  readonly enabled: boolean;
  readonly algorithm: 'AES-256-GCM';
  readonly keyMaterial: string;
  readonly switchesMonth: string; // YYYY-MM
  readonly switchesThisMonth: number; // 0..2
  readonly enabledAtIso: string | null;
}

export type GoalCompletionFilter = 'all' | 'ongoing' | 'completed';
export type GoalSortKey = 'sortOrder' | 'title' | 'startDate' | 'endDate' | 'primaryDays';
export type SortDirection = 'asc' | 'desc';

export interface GoalFilterCriteria {
  readonly search: string;
  readonly completion: GoalCompletionFilter;
  readonly sortKey: GoalSortKey;
  readonly sortDir: SortDirection;
}
