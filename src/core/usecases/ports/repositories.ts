import {
  GoalEntry,
  GoalInput,
  RoadmapItem,
  TipInput,
  TipNote,
  UserEncryptionSecurity,
  UserMfaSecurity,
  UserProfile,
} from '../../domain/entities/models';

export type UnsubscribeFn = () => void;

export interface GoalRepository {
  setEncryptionKey?(key: CryptoKey | null): void;
  subscribe(ownerId: string, onChange: (goals: GoalEntry[]) => void, onError: (err: Error) => void): UnsubscribeFn;
  create(ownerId: string, input: GoalInput, sortOrder: number): Promise<GoalEntry>;
  update(ownerId: string, goalId: string, input: Partial<GoalInput & { sortOrder: number }>): Promise<void>;
  delete(ownerId: string, goalId: string): Promise<void>;
}

export interface TipRepository {
  setEncryptionKey?(key: CryptoKey | null): void;
  subscribe(ownerId: string, onChange: (tips: TipNote[]) => void, onError: (err: Error) => void): UnsubscribeFn;
  create(ownerId: string, input: TipInput): Promise<TipNote>;
  update(ownerId: string, tipId: string, patch: Partial<TipInput & { done: boolean }>): Promise<void>;
  delete(ownerId: string, tipId: string): Promise<void>;
}

export interface RoadmapRepository {
  setEncryptionKey?(key: CryptoKey | null): void;
  subscribe(ownerId: string, onChange: (items: RoadmapItem[]) => void, onError: (err: Error) => void): UnsubscribeFn;
  create(ownerId: string, text: string, done?: boolean): Promise<RoadmapItem>;
  update(ownerId: string, itemId: string, patch: { text?: string; done?: boolean }): Promise<void>;
  delete(ownerId: string, itemId: string): Promise<void>;
}

export interface UserProfileRepository {
  getOrCreate(ownerId: string, defaultDisplayName: string): Promise<UserProfile>;
  update(ownerId: string, profile: UserProfile): Promise<void>;
}

export interface MfaSecurityRepository {
  get(ownerId: string): Promise<UserMfaSecurity | null>;
  save(ownerId: string, config: UserMfaSecurity): Promise<void>;
  consumeBackupCode(ownerId: string, remainingHashes: readonly string[]): Promise<void>;
}

export interface EncryptionSecurityRepository {
  get(ownerId: string): Promise<UserEncryptionSecurity | null>;
  save(ownerId: string, config: UserEncryptionSecurity): Promise<void>;
}
