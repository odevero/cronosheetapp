import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
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
import {
  decryptTextField,
  ENCRYPTION_ALGORITHM,
  encryptTextField,
} from '../../domain/services/data-encryption';
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
import { handleFirestoreError, OperationType } from './firebase-client';

function generateSafeId(prefix: string): string {
  const rand = new Uint8Array(9);
  globalThis.crypto.getRandomValues(rand);
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now().toString(36)}_${hex}`;
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

export class FirestoreGoalRepository implements GoalRepository {
  private cryptoKey: CryptoKey | null = null;

  constructor(private readonly db: Firestore) {}

  setEncryptionKey(key: CryptoKey | null): void {
    this.cryptoKey = key;
  }

  subscribe(
    ownerId: string,
    onChange: (goals: GoalEntry[]) => void,
    onError: (err: Error) => void,
  ): UnsubscribeFn {
    const path = `users/${ownerId}/goals`;
    const q = query(
      collection(this.db, path),
      where('ownerId', '==', ownerId),
      orderBy('sortOrder', 'asc'),
    );
    let snapSeq = 0;
    return onSnapshot(
      q,
      (snap) => {
        const seq = ++snapSeq;
        const activeKey = this.cryptoKey;
        void Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            const [title, notes] = await Promise.all([
              decryptTextField(String(data['title'] ?? ''), activeKey),
              decryptTextField(String(data['notes'] ?? ''), activeKey),
            ]);
            return {
              id: d.id,
              ownerId: String(data['ownerId'] ?? ownerId),
              title,
              startDate: String(data['startDate'] ?? ''),
              endDate: String(data['endDate'] ?? ''),
              notes,
              sortOrder: Number(data['sortOrder'] ?? 0),
              createdAtIso: timestampToIso(data['createdAt']),
              updatedAtIso: timestampToIso(data['updatedAt']),
            };
          }),
        )
          .then((items) => {
            if (seq === snapSeq) {
              onChange(items);
            }
          })
          .catch((err) => {
            onError(err instanceof Error ? err : new Error(String(err)));
          });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      },
    );
  }

  async create(ownerId: string, input: GoalInput, sortOrder: number): Promise<GoalEntry> {
    const safe = sanitizeGoalInput(input);
    const id = generateSafeId('goal');
    const path = `users/${ownerId}/goals/${id}`;
    const nowIso = new Date().toISOString();
    try {
      const [storedTitle, storedNotes] = await Promise.all([
        encryptTextField(safe.title, this.cryptoKey),
        encryptTextField(safe.notes, this.cryptoKey),
      ]);
      await setDoc(doc(this.db, path), {
        ownerId,
        title: storedTitle,
        startDate: safe.startDate,
        endDate: safe.endDate,
        notes: storedNotes,
        sortOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id,
        ownerId,
        ...safe,
        sortOrder,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async update(
    ownerId: string,
    goalId: string,
    input: Partial<GoalInput & { sortOrder: number }>,
  ): Promise<void> {
    const path = `users/${ownerId}/goals/${goalId}`;
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (input.title !== undefined) {
      payload['title'] = await encryptTextField(input.title.trim().slice(0, 160), this.cryptoKey);
    }
    if (input.startDate !== undefined) payload['startDate'] = input.startDate.trim().slice(0, 10);
    if (input.endDate !== undefined) payload['endDate'] = input.endDate.trim().slice(0, 10);
    if (input.notes !== undefined) {
      payload['notes'] = await encryptTextField(input.notes.trim().slice(0, 1000), this.cryptoKey);
    }
    if (input.sortOrder !== undefined) payload['sortOrder'] = input.sortOrder;

    try {
      await updateDoc(doc(this.db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async delete(ownerId: string, goalId: string): Promise<void> {
    const path = `users/${ownerId}/goals/${goalId}`;
    try {
      await deleteDoc(doc(this.db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export class FirestoreTipRepository implements TipRepository {
  private cryptoKey: CryptoKey | null = null;

  constructor(private readonly db: Firestore) {}

  setEncryptionKey(key: CryptoKey | null): void {
    this.cryptoKey = key;
  }

  subscribe(
    ownerId: string,
    onChange: (tips: TipNote[]) => void,
    onError: (err: Error) => void,
  ): UnsubscribeFn {
    const path = `users/${ownerId}/tips`;
    const q = query(collection(this.db, path), where('ownerId', '==', ownerId));
    let snapSeq = 0;
    return onSnapshot(
      q,
      (snap) => {
        const seq = ++snapSeq;
        const activeKey = this.cryptoKey;
        void Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            const nextStep = await decryptTextField(String(data['nextStep'] ?? ''), activeKey);
            return {
              id: d.id,
              ownerId: String(data['ownerId'] ?? ownerId),
              goalId: String(data['goalId'] ?? ''),
              nextStep,
              done: Boolean(data['done']),
              createdAtIso: timestampToIso(data['createdAt']),
              updatedAtIso: timestampToIso(data['updatedAt']),
            };
          }),
        )
          .then((items) => {
            if (seq === snapSeq) {
              items.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
              onChange(items);
            }
          })
          .catch((err) => {
            onError(err instanceof Error ? err : new Error(String(err)));
          });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      },
    );
  }

  async create(ownerId: string, input: TipInput): Promise<TipNote> {
    const id = generateSafeId('tip');
    const path = `users/${ownerId}/tips/${id}`;
    const nowIso = new Date().toISOString();
    const nextStep = input.nextStep.trim().slice(0, 500);
    try {
      const storedStep = await encryptTextField(nextStep, this.cryptoKey);
      await setDoc(doc(this.db, path), {
        ownerId,
        goalId: input.goalId,
        nextStep: storedStep,
        done: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id,
        ownerId,
        goalId: input.goalId,
        nextStep,
        done: false,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async update(
    ownerId: string,
    tipId: string,
    patch: Partial<TipInput & { done: boolean }>,
  ): Promise<void> {
    const path = `users/${ownerId}/tips/${tipId}`;
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.goalId !== undefined) payload['goalId'] = patch.goalId;
    if (patch.nextStep !== undefined) {
      payload['nextStep'] = await encryptTextField(patch.nextStep.trim().slice(0, 500), this.cryptoKey);
    }
    if (patch.done !== undefined) payload['done'] = patch.done;

    try {
      await updateDoc(doc(this.db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async delete(ownerId: string, tipId: string): Promise<void> {
    const path = `users/${ownerId}/tips/${tipId}`;
    try {
      await deleteDoc(doc(this.db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export class FirestoreRoadmapRepository implements RoadmapRepository {
  private cryptoKey: CryptoKey | null = null;

  constructor(private readonly db: Firestore) {}

  setEncryptionKey(key: CryptoKey | null): void {
    this.cryptoKey = key;
  }

  subscribe(
    ownerId: string,
    onChange: (items: RoadmapItem[]) => void,
    onError: (err: Error) => void,
  ): UnsubscribeFn {
    const path = `users/${ownerId}/roadmap`;
    const q = query(collection(this.db, path), where('ownerId', '==', ownerId));
    let snapSeq = 0;
    return onSnapshot(
      q,
      (snap) => {
        const seq = ++snapSeq;
        const activeKey = this.cryptoKey;
        void Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            const text = await decryptTextField(String(data['text'] ?? ''), activeKey);
            return {
              id: d.id,
              ownerId: String(data['ownerId'] ?? ownerId),
              text,
              done: Boolean(data['done']),
              createdAtIso: timestampToIso(data['createdAt']),
              updatedAtIso: timestampToIso(data['updatedAt']),
            };
          }),
        )
          .then((items) => {
            if (seq === snapSeq) {
              items.sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
              onChange(items);
            }
          })
          .catch((err) => {
            onError(err instanceof Error ? err : new Error(String(err)));
          });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      },
    );
  }

  async create(ownerId: string, text: string, done = false): Promise<RoadmapItem> {
    const id = generateSafeId('next');
    const path = `users/${ownerId}/roadmap/${id}`;
    const cleanText = text.trim().slice(0, 300);
    const nowIso = new Date().toISOString();
    try {
      const storedText = await encryptTextField(cleanText, this.cryptoKey);
      await setDoc(doc(this.db, path), {
        ownerId,
        text: storedText,
        done,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id,
        ownerId,
        text: cleanText,
        done,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async update(
    ownerId: string,
    itemId: string,
    patch: { text?: string; done?: boolean },
  ): Promise<void> {
    const path = `users/${ownerId}/roadmap/${itemId}`;
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.text !== undefined) {
      payload['text'] = await encryptTextField(patch.text.trim().slice(0, 300), this.cryptoKey);
    }
    if (patch.done !== undefined) payload['done'] = patch.done;

    try {
      await updateDoc(doc(this.db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async delete(ownerId: string, itemId: string): Promise<void> {
    const path = `users/${ownerId}/roadmap/${itemId}`;
    try {
      await deleteDoc(doc(this.db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export class FirestoreUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: Firestore) {}

  async getOrCreate(ownerId: string, defaultDisplayName: string): Promise<UserProfile> {
    const path = `users/${ownerId}`;
    try {
      const snap = await getDoc(doc(this.db, path));
      if (snap.exists()) {
        const d = snap.data();
        return {
          ownerId,
          displayName: String(d['displayName'] ?? defaultDisplayName),
          paletteStartRow: Number(d['paletteStartRow'] ?? 1),
          thresholds: {
            anniversaryDays: Number(d['anniversaryLookaheadDays'] ?? DEFAULT_RECURRENCE_THRESHOLDS.anniversaryDays),
            monthiversaryDays: Number(d['monthiversaryLookaheadDays'] ?? DEFAULT_RECURRENCE_THRESHOLDS.monthiversaryDays),
            weekiversaryDays: Number(d['weekiversaryLookaheadDays'] ?? DEFAULT_RECURRENCE_THRESHOLDS.weekiversaryDays),
            milestoneDays: Number(d['milestoneLookaheadDays'] ?? DEFAULT_RECURRENCE_THRESHOLDS.milestoneDays),
          },
        };
      }

      const initial: UserProfile = {
        ownerId,
        displayName: (defaultDisplayName.trim() || 'Utente').slice(0, 100),
        paletteStartRow: 1,
        thresholds: { ...DEFAULT_RECURRENCE_THRESHOLDS },
      };

      await setDoc(doc(this.db, path), {
        ownerId,
        displayName: initial.displayName,
        paletteStartRow: initial.paletteStartRow,
        anniversaryLookaheadDays: initial.thresholds.anniversaryDays,
        monthiversaryLookaheadDays: initial.thresholds.monthiversaryDays,
        weekiversaryLookaheadDays: initial.thresholds.weekiversaryDays,
        milestoneLookaheadDays: initial.thresholds.milestoneDays,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return initial;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async update(ownerId: string, profile: UserProfile): Promise<void> {
    const path = `users/${ownerId}`;
    const safeName = (profile.displayName.trim() || 'Utente').slice(0, 100);
    const safeFields = {
      displayName: safeName,
      paletteStartRow: Math.max(1, Math.min(10, Math.round(profile.paletteStartRow))),
      anniversaryLookaheadDays: Math.max(1, Math.min(60, Math.round(profile.thresholds.anniversaryDays))),
      monthiversaryLookaheadDays: Math.max(1, Math.min(30, Math.round(profile.thresholds.monthiversaryDays))),
      weekiversaryLookaheadDays: Math.max(1, Math.min(14, Math.round(profile.thresholds.weekiversaryDays))),
      milestoneLookaheadDays: Math.max(1, Math.min(60, Math.round(profile.thresholds.milestoneDays))),
      updatedAt: serverTimestamp(),
    };
    try {
      const ref = doc(this.db, path);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, safeFields);
      } else {
        await setDoc(ref, {
          ownerId,
          ...safeFields,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export class FirestoreMfaSecurityRepository implements MfaSecurityRepository {
  constructor(private readonly db: Firestore) {}

  async get(ownerId: string): Promise<UserMfaSecurity | null> {
    const path = `users/${ownerId}/security/mfa`;
    try {
      const snap = await getDoc(doc(this.db, path));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        ownerId,
        totpEnabled: Boolean(d['totpEnabled']),
        totpSecret: String(d['totpSecret'] ?? ''),
        backupCodeHashes: Array.isArray(d['backupCodeHashes'])
          ? d['backupCodeHashes'].map(String)
          : [],
        enrolledAtIso: d['enrolledAt'] ? timestampToIso(d['enrolledAt']) : null,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async save(ownerId: string, config: UserMfaSecurity): Promise<void> {
    const path = `users/${ownerId}/security/mfa`;
    try {
      const existing = await getDoc(doc(this.db, path));
      const payload = {
        ownerId,
        totpEnabled: config.totpEnabled,
        totpSecret: config.totpSecret.slice(0, 128),
        backupCodeHashes: config.backupCodeHashes.slice(0, 10),
        enrolledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (existing.exists()) {
        await updateDoc(doc(this.db, path), payload);
      } else {
        await setDoc(doc(this.db, path), payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async consumeBackupCode(ownerId: string, remainingHashes: readonly string[]): Promise<void> {
    const path = `users/${ownerId}/security/mfa`;
    try {
      await updateDoc(doc(this.db, path), {
        backupCodeHashes: remainingHashes.slice(0, 10),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export class FirestoreEncryptionSecurityRepository implements EncryptionSecurityRepository {
  constructor(private readonly db: Firestore) {}

  async get(ownerId: string): Promise<UserEncryptionSecurity | null> {
    const path = `users/${ownerId}/security/encryption`;
    try {
      const snap = await getDoc(doc(this.db, path));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        ownerId,
        enabled: Boolean(d['enabled']),
        algorithm: ENCRYPTION_ALGORITHM,
        keyMaterial: String(d['keyMaterial'] ?? ''),
        enabledAtIso: d['enabledAt'] ? timestampToIso(d['enabledAt']) : null,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async save(ownerId: string, config: UserEncryptionSecurity): Promise<void> {
    const path = `users/${ownerId}/security/encryption`;
    try {
      const payload = {
        ownerId,
        enabled: true,
        algorithm: ENCRYPTION_ALGORITHM,
        keyMaterial: config.keyMaterial.slice(0, 128),
        enabledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      // Use setDoc so any legacy switch-quota fields from earlier builds are cleanly stripped
      await setDoc(doc(this.db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}
