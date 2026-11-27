import {
  GoalEntry,
  RoadmapItem,
  TipInput,
  TipNote,
  UserEncryptionSecurity,
  UserMfaSecurity,
  UserProfile,
} from '../../domain/entities/models';
import { getTodayIsoLocal } from '../../domain/services/calendar-duration';
import { decryptTextField, encryptTextField } from '../../domain/services/data-encryption';
import { DEFAULT_RECURRENCE_THRESHOLDS } from '../../domain/services/recurrence-scanner';
import { sanitizeGoalInput } from '../../usecases/goal-usecases';
import {
  EncryptionSecurityRepository,
  GoalRepository,
  MfaSecurityRepository,
  RoadmapRepository,
  TipRepository,
  UnsubscribeFn,
  UserProfileRepository,
} from '../../usecases/ports/repositories';
import { buildSeedDataset } from './seed-data';

const STORAGE_KEYS = {
  goals: 'cronosheet_demo_v2_goals',
  tips: 'cronosheet_demo_v3_tips',
  roadmap: 'cronosheet_demo_v2_roadmap',
  profile: 'cronosheet_demo_v2_profile',
  mfa: 'cronosheet_demo_v2_mfa',
  encryption: 'cronosheet_demo_v2_encryption',
} as const;

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in sandboxed frames
  }
}

function makeLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class LocalDemoStore {
  private goals: GoalEntry[] = [];
  private tips: TipNote[] = [];
  private roadmap: RoadmapItem[] = [];
  private profile: UserProfile;
  private mfa: UserMfaSecurity | null = null;
  private encryption: UserEncryptionSecurity | null = null;
  private cryptoKey: CryptoKey | null = null;

  private readonly goalListeners = new Set<(items: GoalEntry[]) => void>();
  private readonly tipListeners = new Set<(items: TipNote[]) => void>();
  private readonly roadmapListeners = new Set<(items: RoadmapItem[]) => void>();

  constructor(private readonly ownerId = 'demo_user') {
    const seed = buildSeedDataset(ownerId, getTodayIsoLocal());
    this.goals = readJson<GoalEntry[]>(STORAGE_KEYS.goals) ?? seed.goals;
    this.tips = readJson<TipNote[]>(STORAGE_KEYS.tips) ?? seed.tips;
    this.roadmap = readJson<RoadmapItem[]>(STORAGE_KEYS.roadmap) ?? seed.roadmap;
    this.profile = readJson<UserProfile>(STORAGE_KEYS.profile) ?? {
      ownerId,
      displayName: 'Workspace Demo',
      paletteStartRow: 1,
      thresholds: { ...DEFAULT_RECURRENCE_THRESHOLDS },
    };
    this.mfa = readJson<UserMfaSecurity>(STORAGE_KEYS.mfa);
    this.encryption = readJson<UserEncryptionSecurity>(STORAGE_KEYS.encryption);
  }

  private async decryptGoals(rawGoals: readonly GoalEntry[]): Promise<GoalEntry[]> {
    const key = this.cryptoKey;
    return Promise.all(
      rawGoals.map(async (g) => ({
        ...g,
        title: await decryptTextField(g.title, key),
        notes: await decryptTextField(g.notes, key),
      })),
    );
  }

  private async decryptTips(rawTips: readonly TipNote[]): Promise<TipNote[]> {
    const key = this.cryptoKey;
    return Promise.all(
      rawTips.map(async (t) => ({
        ...t,
        nextStep: await decryptTextField(t.nextStep, key),
      })),
    );
  }

  private async decryptRoadmap(rawItems: readonly RoadmapItem[]): Promise<RoadmapItem[]> {
    const key = this.cryptoKey;
    return Promise.all(
      rawItems.map(async (r) => ({
        ...r,
        text: await decryptTextField(r.text, key),
      })),
    );
  }

  readonly goalsRepo: GoalRepository = {
    setEncryptionKey: (key: CryptoKey | null) => {
      this.cryptoKey = key;
    },
    subscribe: (_ownerId, onChange): UnsubscribeFn => {
      this.goalListeners.add(onChange);
      void this.decryptGoals([...this.goals].sort((a, b) => a.sortOrder - b.sortOrder)).then(
        (decrypted) => onChange(decrypted),
      );
      return () => {
        this.goalListeners.delete(onChange);
      };
    },
    create: async (ownerId, input, sortOrder) => {
      const safe = sanitizeGoalInput(input);
      const nowIso = new Date().toISOString();
      const id = makeLocalId('goal');
      const [storedTitle, storedNotes] = await Promise.all([
        encryptTextField(safe.title, this.cryptoKey),
        encryptTextField(safe.notes, this.cryptoKey),
      ]);
      const stored: GoalEntry = {
        id,
        ownerId,
        title: storedTitle,
        startDate: safe.startDate,
        endDate: safe.endDate,
        notes: storedNotes,
        sortOrder,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
      this.goals = [...this.goals, stored];
      writeJson(STORAGE_KEYS.goals, this.goals);
      this.emitGoals();
      return {
        id,
        ownerId,
        ...safe,
        sortOrder,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
    },
    update: async (_ownerId, goalId, patch) => {
      const nowIso = new Date().toISOString();
      const encTitle =
        patch.title !== undefined
          ? await encryptTextField(patch.title.trim().slice(0, 160), this.cryptoKey)
          : undefined;
      const encNotes =
        patch.notes !== undefined
          ? await encryptTextField(patch.notes.trim().slice(0, 1000), this.cryptoKey)
          : undefined;
      this.goals = this.goals.map((g) => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          title: encTitle !== undefined ? encTitle : g.title,
          startDate: patch.startDate !== undefined ? patch.startDate.trim() : g.startDate,
          endDate: patch.endDate !== undefined ? patch.endDate.trim() : g.endDate,
          notes: encNotes !== undefined ? encNotes : g.notes,
          sortOrder: patch.sortOrder !== undefined ? patch.sortOrder : g.sortOrder,
          updatedAtIso: nowIso,
        };
      });
      writeJson(STORAGE_KEYS.goals, this.goals);
      this.emitGoals();
    },
    delete: async (_ownerId, goalId) => {
      this.goals = this.goals.filter((g) => g.id !== goalId);
      writeJson(STORAGE_KEYS.goals, this.goals);
      this.emitGoals();
    },
  };

  readonly tipsRepo: TipRepository = {
    setEncryptionKey: (key: CryptoKey | null) => {
      this.cryptoKey = key;
    },
    subscribe: (_ownerId, onChange): UnsubscribeFn => {
      this.tipListeners.add(onChange);
      void this.decryptTips(this.tips).then((decrypted) => onChange(decrypted));
      return () => {
        this.tipListeners.delete(onChange);
      };
    },
    create: async (ownerId, input: TipInput) => {
      const nowIso = new Date().toISOString();
      const id = makeLocalId('tip');
      const plainStep = input.nextStep.trim().slice(0, 500);
      const storedStep = await encryptTextField(plainStep, this.cryptoKey);
      const stored: TipNote = {
        id,
        ownerId,
        goalId: input.goalId,
        nextStep: storedStep,
        done: false,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
      this.tips = [stored, ...this.tips];
      writeJson(STORAGE_KEYS.tips, this.tips);
      this.emitTips();
      return {
        ...stored,
        nextStep: plainStep,
      };
    },
    update: async (_ownerId, tipId, patch) => {
      const nowIso = new Date().toISOString();
      const encStep =
        patch.nextStep !== undefined
          ? await encryptTextField(patch.nextStep.trim().slice(0, 500), this.cryptoKey)
          : undefined;
      this.tips = this.tips.map((t) =>
        t.id === tipId
          ? {
              ...t,
              goalId: patch.goalId ?? t.goalId,
              nextStep: encStep !== undefined ? encStep : t.nextStep,
              done: patch.done ?? t.done,
              updatedAtIso: nowIso,
            }
          : t,
      );
      writeJson(STORAGE_KEYS.tips, this.tips);
      this.emitTips();
    },
    delete: async (_ownerId, tipId) => {
      this.tips = this.tips.filter((t) => t.id !== tipId);
      writeJson(STORAGE_KEYS.tips, this.tips);
      this.emitTips();
    },
  };

  readonly roadmapRepo: RoadmapRepository = {
    setEncryptionKey: (key: CryptoKey | null) => {
      this.cryptoKey = key;
    },
    subscribe: (_ownerId, onChange): UnsubscribeFn => {
      this.roadmapListeners.add(onChange);
      void this.decryptRoadmap(this.roadmap).then((decrypted) => onChange(decrypted));
      return () => {
        this.roadmapListeners.delete(onChange);
      };
    },
    create: async (ownerId, text, done = false) => {
      const nowIso = new Date().toISOString();
      const id = makeLocalId('next');
      const plainText = text.trim().slice(0, 300);
      const storedText = await encryptTextField(plainText, this.cryptoKey);
      const stored: RoadmapItem = {
        id,
        ownerId,
        text: storedText,
        done,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
      this.roadmap = [...this.roadmap, stored];
      writeJson(STORAGE_KEYS.roadmap, this.roadmap);
      this.emitRoadmap();
      return {
        ...stored,
        text: plainText,
      };
    },
    update: async (_ownerId, itemId, patch) => {
      const nowIso = new Date().toISOString();
      const encText =
        patch.text !== undefined
          ? await encryptTextField(patch.text.trim().slice(0, 300), this.cryptoKey)
          : undefined;
      this.roadmap = this.roadmap.map((r) =>
        r.id === itemId
          ? {
              ...r,
              text: encText !== undefined ? encText : r.text,
              done: patch.done ?? r.done,
              updatedAtIso: nowIso,
            }
          : r,
      );
      writeJson(STORAGE_KEYS.roadmap, this.roadmap);
      this.emitRoadmap();
    },
    delete: async (_ownerId, itemId) => {
      this.roadmap = this.roadmap.filter((r) => r.id !== itemId);
      writeJson(STORAGE_KEYS.roadmap, this.roadmap);
      this.emitRoadmap();
    },
  };

  readonly profileRepo: UserProfileRepository = {
    getOrCreate: async () => ({ ...this.profile }),
    update: async (_ownerId, profile) => {
      this.profile = { ...profile };
      writeJson(STORAGE_KEYS.profile, this.profile);
    },
  };

  readonly mfaRepo: MfaSecurityRepository = {
    get: async () => (this.mfa ? { ...this.mfa } : null),
    save: async (_ownerId, config) => {
      this.mfa = { ...config };
      writeJson(STORAGE_KEYS.mfa, this.mfa);
    },
    consumeBackupCode: async (_ownerId, remainingHashes) => {
      if (!this.mfa) return;
      this.mfa = { ...this.mfa, backupCodeHashes: [...remainingHashes] };
      writeJson(STORAGE_KEYS.mfa, this.mfa);
    },
  };

  readonly encryptionRepo: EncryptionSecurityRepository = {
    get: async () => (this.encryption ? { ...this.encryption } : null),
    save: async (_ownerId, config) => {
      this.encryption = { ...config };
      writeJson(STORAGE_KEYS.encryption, this.encryption);
    },
  };

  resetToSeed(): void {
    void this.resetToSeedAsync();
  }

  private async resetToSeedAsync(): Promise<void> {
    const seed = buildSeedDataset(this.ownerId, getTodayIsoLocal());
    this.goals = await Promise.all(
      seed.goals.map(async (g) => ({
        ...g,
        title: await encryptTextField(g.title, this.cryptoKey),
        notes: await encryptTextField(g.notes, this.cryptoKey),
      })),
    );
    this.tips = await Promise.all(
      seed.tips.map(async (t) => ({
        ...t,
        nextStep: await encryptTextField(t.nextStep, this.cryptoKey),
      })),
    );
    this.roadmap = await Promise.all(
      seed.roadmap.map(async (r) => ({
        ...r,
        text: await encryptTextField(r.text, this.cryptoKey),
      })),
    );
    writeJson(STORAGE_KEYS.goals, this.goals);
    writeJson(STORAGE_KEYS.tips, this.tips);
    writeJson(STORAGE_KEYS.roadmap, this.roadmap);
    this.emitGoals();
    this.emitTips();
    this.emitRoadmap();
  }

  private emitGoals(): void {
    void this.decryptGoals([...this.goals].sort((a, b) => a.sortOrder - b.sortOrder)).then(
      (decrypted) => {
        this.goalListeners.forEach((cb) => cb(decrypted));
      },
    );
  }

  private emitTips(): void {
    void this.decryptTips(this.tips).then((decrypted) => {
      this.tipListeners.forEach((cb) => cb(decrypted));
    });
  }

  private emitRoadmap(): void {
    void this.decryptRoadmap(this.roadmap).then((decrypted) => {
      this.roadmapListeners.forEach((cb) => cb(decrypted));
    });
  }
}
