import { computed, Injectable, signal } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  EnrichedGoal,
  GoalEntry,
  GoalFilterCriteria,
  GoalInput,
  RecurrenceThresholds,
  RoadmapItem,
  TipInput,
  TipNote,
  UserEncryptionSecurity,
  UserMfaSecurity,
  UserProfile,
} from '../domain/entities/models';
import { getTodayIsoLocal } from '../domain/services/calendar-duration';
import {
  ENCRYPTION_ALGORITHM,
  generateAes256KeyMaterial,
  getCurrentYearMonth,
  getEncryptionSwitchQuota,
  importAes256Key,
} from '../domain/services/data-encryption';
import {
  clearHistory,
  createHistoryState,
  HistoryState,
  mapHistoryEntries,
  peekRedo,
  peekUndo,
  popRedo,
  popUndo,
  pushHistory,
} from '../domain/services/history-stack';
import { MessageLanguage } from '../domain/services/message-generator';
import {
  DEFAULT_RECURRENCE_THRESHOLDS,
  scanUpcomingRecurrences,
} from '../domain/services/recurrence-scanner';
import { FeedbackSurface } from '../domain/services/feedback-issue';
import {
  formatShowcaseBrandTitle,
  isGenericOrEmailDerivedName,
  needsNameOnboarding,
  normalizeDisplayName,
  validateDisplayName,
} from '../domain/services/profile-display';
import { exportWorkspaceBackupJson } from '../domain/services/goal-import-export';
import { isFirebasePopupAssertionRace } from '../domain/services/firebase-error-filter';
import {
  enrichGoals,
  exportGoalsToCsv,
  filterAndSortGoals,
  validateGoalInput,
} from '../usecases/goal-usecases';
import {
  createMfaEnrollmentDraft,
  finalizeMfaEnrollment,
  MfaEnrollmentDraft,
  verifyMfaChallenge,
} from '../usecases/mfa-usecases';
import {
  EncryptionSecurityRepository,
  GoalRepository,
  MfaSecurityRepository,
  RoadmapRepository,
  TipRepository,
  UnsubscribeFn,
  UserProfileRepository,
} from '../usecases/ports/repositories';
import { getFirebaseClients, isFirebaseConfigured } from '../adapters/firebase/firebase-client';
import {
  FirestoreEncryptionSecurityRepository,
  FirestoreGoalRepository,
  FirestoreMfaSecurityRepository,
  FirestoreRoadmapRepository,
  FirestoreTipRepository,
  FirestoreUserProfileRepository,
} from '../adapters/firebase/firestore-repositories';
import { LocalDemoStore } from '../adapters/local/local-demo-repositories';
import { buildSeedDataset } from '../adapters/local/seed-data';

export type AppSurface = 'landing' | 'app';
export type WorkspaceTab = 'data' | 'recurrences' | 'memo' | 'filtersort' | 'security' | 'next';
export type WorkspaceMode = 'showcase' | 'backend';
export type AuthStage =
  | 'loading'
  | 'unauthenticated'
  | 'email_verification_required'
  | 'mfa_required'
  | 'authenticated';
export type SessionMode = 'firebase' | 'demo';

export interface ActiveSessionUser {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string;
  readonly emailVerified: boolean;
  readonly mode: SessionMode;
  readonly photoUrl: string | null;
}

export type UndoCommand =
  | {
      readonly kind: 'goal:create';
      readonly goalId: string;
      readonly input: GoalInput;
      readonly sortOrder: number;
      readonly label: string;
    }
  | {
      readonly kind: 'goal:update';
      readonly goalId: string;
      readonly before: GoalInput;
      readonly after: GoalInput;
      readonly label: string;
    }
  | {
      readonly kind: 'goal:delete';
      readonly goalId: string;
      readonly input: GoalInput;
      readonly sortOrder: number;
      readonly label: string;
    }
  | {
      readonly kind: 'goal:batch-create';
      readonly items: readonly {
        readonly goalId: string;
        readonly input: GoalInput;
        readonly sortOrder: number;
      }[];
      readonly label: string;
    }
  | {
      readonly kind: 'tip:create';
      readonly tipId: string;
      readonly input: TipInput;
      readonly done: boolean;
      readonly label: string;
    }
  | {
      readonly kind: 'tip:update';
      readonly tipId: string;
      readonly before: TipInput & { readonly done: boolean };
      readonly after: TipInput & { readonly done: boolean };
      readonly label: string;
    }
  | {
      readonly kind: 'tip:delete';
      readonly tipId: string;
      readonly input: TipInput;
      readonly done: boolean;
      readonly label: string;
    }
  | {
      readonly kind: 'roadmap:create';
      readonly itemId: string;
      readonly text: string;
      readonly done: boolean;
      readonly label: string;
    }
  | {
      readonly kind: 'roadmap:update';
      readonly itemId: string;
      readonly before: { readonly text: string; readonly done: boolean };
      readonly after: { readonly text: string; readonly done: boolean };
      readonly label: string;
    }
  | {
      readonly kind: 'roadmap:delete';
      readonly itemId: string;
      readonly text: string;
      readonly done: boolean;
      readonly label: string;
    };

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  // Navigation & UI state
  readonly appSurface = signal<AppSurface>('landing');
  readonly workspaceMode = signal<WorkspaceMode>('showcase');
  readonly activeTab = signal<WorkspaceTab>('data');
  readonly referenceDateIso = signal<string>(getTodayIsoLocal());
  readonly showDebugColumns = signal<boolean>(false);
  readonly focusNewRowSignal = signal<number>(0);
  readonly feedbackModalOpen = signal<boolean>(false);
  readonly feedbackSurface = signal<FeedbackSurface>('landing');
  readonly socialShareGoal = signal<EnrichedGoal | null>(null);
  readonly importModalOpen = signal<boolean>(false);
  readonly statusBanner = signal<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null);

  // Auth & MFA state
  readonly authStage = signal<AuthStage>('loading');
  readonly sessionUser = signal<ActiveSessionUser | null>(null);
  readonly authError = signal<string | null>(null);
  readonly authNotice = signal<string | null>(null);
  readonly authBusy = signal<boolean>(false);
  readonly firebaseAvailable = signal<boolean>(isFirebaseConfigured());
  readonly profileLoaded = signal<boolean>(false);

  // Core data signals
  readonly goals = signal<GoalEntry[]>([]);
  readonly tips = signal<TipNote[]>([]);
  readonly roadmapItems = signal<RoadmapItem[]>([]);
  readonly profile = signal<UserProfile>({
    ownerId: 'guest',
    displayName: 'Utente',
    paletteStartRow: 1,
    thresholds: { ...DEFAULT_RECURRENCE_THRESHOLDS },
  });
  readonly mfaConfig = signal<UserMfaSecurity | null>(null);
  readonly pendingMfaDraft = signal<MfaEnrollmentDraft | null>(null);
  readonly encryptionConfig = signal<UserEncryptionSecurity | null>(null);
  readonly encryptionBusy = signal<boolean>(false);
  readonly encryptionEnabled = computed(() => Boolean(this.encryptionConfig()?.enabled));
  readonly encryptionQuota = computed(() => getEncryptionSwitchQuota(this.encryptionConfig()));

  // Language for generated shareable messages (EN default so English infinitives stay intact; user can switch to IT or ES)
  readonly messageLanguage = signal<MessageLanguage>(this.loadInitialMessageLanguage());

  // Undo / Redo command history (Ctrl+Z / Ctrl+Y)
  private readonly historyState = signal<HistoryState<UndoCommand>>(createHistoryState<UndoCommand>(50));
  readonly historyBusy = signal<boolean>(false);
  readonly canUndo = computed(() => this.historyState().past.length > 0 && !this.historyBusy());
  readonly canRedo = computed(() => this.historyState().future.length > 0 && !this.historyBusy());
  readonly undoLabel = computed(() => peekUndo(this.historyState())?.label ?? null);
  readonly redoLabel = computed(() => peekRedo(this.historyState())?.label ?? null);

  // FilterSort view state (non-destructive)
  readonly filterCriteria = signal<GoalFilterCriteria>({
    search: '',
    completion: 'all',
    sortKey: 'sortOrder',
    sortDir: 'asc',
  });

  // Derived computed views
  readonly enrichedGoals = computed(() =>
    enrichGoals(
      this.goals(),
      this.referenceDateIso(),
      this.profile().paletteStartRow,
      this.messageLanguage(),
    ),
  );

  readonly filteredGoals = computed(() =>
    filterAndSortGoals(this.enrichedGoals(), this.filterCriteria()),
  );

  readonly recurrences = computed(() =>
    scanUpcomingRecurrences(
      this.goals(),
      this.referenceDateIso(),
      this.profile().thresholds,
      this.profile().paletteStartRow,
    ),
  );

  readonly summaryStats = computed(() => {
    const all = this.enrichedGoals();
    let ongoing = 0;
    let completed = 0;
    for (const e of all) {
      if (e.metrics.isCompleted) completed++;
      else ongoing++;
    }
    return {
      total: all.length,
      ongoing,
      completed,
      upcomingRecurrences: this.recurrences().totalCount,
      openMemos: this.tips().filter((t) => !t.done).length,
    };
  });

  readonly showcaseOwnerName = computed<string | null>(() => {
    const user = this.sessionUser();
    const profName = this.profileLoaded() ? this.profile().displayName : user?.displayName;
    const candidate = profName || user?.displayName;
    if (isGenericOrEmailDerivedName(candidate, user?.email)) {
      return null;
    }
    return normalizeDisplayName(candidate) || null;
  });

  readonly showcaseBrandTitle = computed(() => {
    const user = this.sessionUser();
    const profName = this.profileLoaded() ? this.profile().displayName : user?.displayName;
    return formatShowcaseBrandTitle(profName || user?.displayName, user?.email);
  });

  readonly requiresNameOnboarding = computed(() => {
    if (this.authStage() !== 'authenticated') return false;
    const user = this.sessionUser();
    if (!user || !this.profileLoaded()) return false;
    return needsNameOnboarding(this.profile().displayName, user.email, user.mode);
  });

  private goalRepo: GoalRepository | null = null;
  private tipRepo: TipRepository | null = null;
  private roadmapRepo: RoadmapRepository | null = null;
  private profileRepo: UserProfileRepository | null = null;
  private mfaRepo: MfaSecurityRepository | null = null;
  private encryptionRepo: EncryptionSecurityRepository | null = null;
  private localStore: LocalDemoStore | null = null;
  private unsubscribers: UnsubscribeFn[] = [];
  private mfaVerifiedForUid: string | null = null;
  private firebaseAuthUnsub: UnsubscribeFn | null = null;
  private registrationInProgress = false;
  private signInSyncPromise: Promise<void> | null = null;
  private signInSyncUid: string | null = null;
  private unlockedUid: string | null = null;
  private lastVerificationResendMs = 0;

  constructor() {
    this.bootstrap();
  }

  private bootstrap(): void {
    if (typeof window === 'undefined') {
      this.authStage.set('unauthenticated');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const autostartDemo = params.get('autostart') === '1';
    const openAppDirectly =
      params.get('view') === 'app' || window.location.pathname === '/app';

    if (autostartDemo) {
      this.appSurface.set('app');
      void this.enterDemoMode();
      return;
    }

    if (openAppDirectly) {
      this.appSurface.set('app');
    }

    const clients = getFirebaseClients();
    if (!clients) {
      this.authStage.set('unauthenticated');
      return;
    }

    this.firebaseAuthUnsub = onAuthStateChanged(clients.auth, (user) => {
      if (this.sessionUser()?.mode === 'demo' || this.registrationInProgress) {
        return;
      }
      if (user) {
        void this.handleFirebaseSignedIn(user);
      } else {
        this.teardownSubscriptions();
        this.sessionUser.set(null);
        this.mfaConfig.set(null);
        this.encryptionConfig.set(null);
        this.mfaVerifiedForUid = null;
        this.unlockedUid = null;
        this.profileLoaded.set(false);
        this.authStage.set('unauthenticated');
      }
    });
  }

  private async handleFirebaseSignedIn(
    user: User,
    options?: { readonly force?: boolean },
  ): Promise<void> {
    if (
      !options?.force &&
      this.unlockedUid === user.uid &&
      this.authStage() === 'authenticated' &&
      this.sessionUser()?.emailVerified
    ) {
      return;
    }

    if (this.signInSyncPromise && this.signInSyncUid === user.uid) {
      return this.signInSyncPromise;
    }

    this.signInSyncUid = user.uid;
    const run = this.runFirebaseSignedIn(user);
    this.signInSyncPromise = run;
    try {
      await run;
    } finally {
      if (this.signInSyncPromise === run) {
        this.signInSyncPromise = null;
        this.signInSyncUid = null;
      }
    }
  }

  private async runFirebaseSignedIn(user: User): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients) return;

    // Refresh user metadata from Firebase Auth so emailVerified reflects link clicks immediately
    try {
      await reload(user);
    } catch {
      // Offline or transient reload error — continue with current user state
    }

    const activeUser: ActiveSessionUser = {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName?.trim() || user.email?.split('@')[0] || 'Utente',
      emailVerified: user.emailVerified,
      mode: 'firebase',
      photoUrl: user.photoURL,
    };
    this.sessionUser.set(activeUser);

    // Block workspace access until email is verified — avoids broken empty state & Firestore permission errors
    if (!user.emailVerified) {
      this.teardownSubscriptions();
      this.unlockedUid = null;
      this.profileLoaded.set(false);
      this.authStage.set('email_verification_required');
      return;
    }

    // Critical: Firebase Auth caches the JWT ID token for up to 1h.
    // Even after reload(user) shows emailVerified === true, Firestore rules check
    // request.auth.token.email_verified inside the signed JWT. Force-refresh if stale!
    try {
      const tokenResult = await user.getIdTokenResult(false);
      if (tokenResult.claims['email_verified'] !== true) {
        await user.getIdToken(true);
      }
    } catch {
      await user.getIdToken(true);
    }

    this.goalRepo = new FirestoreGoalRepository(clients.db);
    this.tipRepo = new FirestoreTipRepository(clients.db);
    this.roadmapRepo = new FirestoreRoadmapRepository(clients.db);
    this.profileRepo = new FirestoreUserProfileRepository(clients.db);
    this.mfaRepo = new FirestoreMfaSecurityRepository(clients.db);
    this.encryptionRepo = new FirestoreEncryptionSecurityRepository(clients.db);

    try {
      const mfa = await this.mfaRepo.get(user.uid);
      this.mfaConfig.set(mfa);

      if (mfa?.totpEnabled && this.mfaVerifiedForUid !== user.uid) {
        this.authStage.set('mfa_required');
        return;
      }

      await this.unlockWorkspace(activeUser);
    } catch (err) {
      this.authError.set(this.friendlyError(err));
      this.authStage.set('unauthenticated');
    }
  }

  private async unlockWorkspace(user: ActiveSessionUser): Promise<void> {
    this.teardownSubscriptions();
    this.historyState.update((h) => clearHistory(h));
    this.workspaceMode.set('showcase');
    this.mfaVerifiedForUid = user.uid;
    this.unlockedUid = user.uid;
    this.authError.set(null);
    this.authNotice.set(null);
    this.profileLoaded.set(false);

    if (this.profileRepo) {
      try {
        const prof = await this.profileRepo.getOrCreate(user.uid, user.displayName);
        this.profile.set(prof);
        this.sessionUser.set({
          ...user,
          displayName: prof.displayName || user.displayName,
        });
        this.profileLoaded.set(true);
      } catch (err) {
        this.notify('error', this.friendlyError(err));
      }
    } else {
      this.profileLoaded.set(true);
    }

    // Load Standard AES-256-GCM encryption key BEFORE subscribing so all snapshots decrypt seamlessly
    if (this.encryptionRepo) {
      try {
        const enc = await this.encryptionRepo.get(user.uid);
        this.encryptionConfig.set(enc);
        if (enc?.enabled && enc.keyMaterial) {
          const key = await importAes256Key(enc.keyMaterial);
          this.applyEncryptionKeyToRepos(key);
        } else {
          this.applyEncryptionKeyToRepos(null);
        }
      } catch {
        this.encryptionConfig.set(null);
        this.applyEncryptionKeyToRepos(null);
      }
    } else {
      this.encryptionConfig.set(null);
      this.applyEncryptionKeyToRepos(null);
    }

    if (this.goalRepo) {
      this.unsubscribers.push(
        this.goalRepo.subscribe(
          user.uid,
          (items) => this.goals.set(items),
          (err) => this.notify('error', this.friendlyError(err)),
        ),
      );
    }

    if (this.tipRepo) {
      this.unsubscribers.push(
        this.tipRepo.subscribe(
          user.uid,
          (items) => this.tips.set(items),
          (err) => this.notify('error', this.friendlyError(err)),
        ),
      );
    }

    if (this.roadmapRepo) {
      this.unsubscribers.push(
        this.roadmapRepo.subscribe(
          user.uid,
          (items) => this.roadmapItems.set(items),
          (err) => this.notify('error', this.friendlyError(err)),
        ),
      );
    }

    this.authStage.set('authenticated');
  }

  openLanding(): void {
    this.appSurface.set('landing');
  }

  openApp(): void {
    this.appSurface.set('app');
  }

  openFeedbackModal(surface?: FeedbackSurface): void {
    const inferred: FeedbackSurface =
      surface ??
      (this.appSurface() === 'landing'
        ? 'landing'
        : this.authStage() !== 'authenticated'
          ? 'auth'
          : this.workspaceMode());
    this.feedbackSurface.set(inferred);
    this.feedbackModalOpen.set(true);
  }

  closeFeedbackModal(): void {
    this.feedbackModalOpen.set(false);
  }

  async enterDemoMode(): Promise<void> {
    this.appSurface.set('app');
    this.authError.set(null);
    this.localStore = new LocalDemoStore('demo_user');
    this.goalRepo = this.localStore.goalsRepo;
    this.tipRepo = this.localStore.tipsRepo;
    this.roadmapRepo = this.localStore.roadmapRepo;
    this.profileRepo = this.localStore.profileRepo;
    this.mfaRepo = this.localStore.mfaRepo;
    this.encryptionRepo = this.localStore.encryptionRepo;

    const demoUser: ActiveSessionUser = {
      uid: 'demo_user',
      email: 'demo@cronosheet.local',
      displayName: 'Workspace Demo',
      emailVerified: true,
      mode: 'demo',
      photoUrl: null,
    };
    this.sessionUser.set(demoUser);

    const mfa = await this.mfaRepo.get(demoUser.uid);
    this.mfaConfig.set(mfa);
    if (mfa?.totpEnabled && this.mfaVerifiedForUid !== demoUser.uid) {
      this.authStage.set('mfa_required');
      return;
    }

    await this.unlockWorkspace(demoUser);
  }

  async signInWithGoogle(): Promise<void> {
    if (this.authBusy()) return;
    const clients = getFirebaseClients();
    if (!clients) {
      this.authError.set('Firebase non è configurato in questo ambiente.');
      return;
    }
    this.authBusy.set(true);
    this.authError.set(null);
    this.authNotice.set(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(clients.auth, provider);
      await this.handleFirebaseSignedIn(cred.user);
    } catch (err) {
      // If the popup closed right as Firebase finished authenticating (known SDK race),
      // currentUser may already be signed in — recover seamlessly without showing an error.
      if (isFirebasePopupAssertionRace(err)) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      const recoveredUser = clients.auth.currentUser;
      if (recoveredUser) {
        await this.handleFirebaseSignedIn(recoveredUser);
      } else {
        this.authError.set(this.friendlyAuthError(err));
      }
    } finally {
      this.authBusy.set(false);
    }
  }

  async signInWithEmailPassword(email: string, password: string): Promise<void> {
    if (this.authBusy()) return;
    const clients = getFirebaseClients();
    if (!clients) {
      this.authError.set('Firebase non è configurato in questo ambiente.');
      return;
    }
    this.authBusy.set(true);
    this.authError.set(null);
    try {
      const cred = await signInWithEmailAndPassword(clients.auth, email.trim(), password);
      await this.handleFirebaseSignedIn(cred.user);
    } catch (err) {
      this.authError.set(this.friendlyAuthError(err));
    } finally {
      this.authBusy.set(false);
    }
  }

  async registerWithEmailPassword(displayName: string, email: string, password: string): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients) {
      this.authError.set('Firebase non è configurato in questo ambiente.');
      return;
    }
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.valid) {
      this.authError.set(nameCheck.error ?? 'Inserisci un nome valido.');
      return;
    }

    this.authBusy.set(true);
    this.authError.set(null);
    this.authNotice.set(null);
    this.registrationInProgress = true;
    try {
      const cred = await createUserWithEmailAndPassword(clients.auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: nameCheck.sanitized });
      await sendEmailVerification(cred.user);
      this.lastVerificationResendMs = Date.now();
      this.authNotice.set(
        `Abbiamo inviato un link di conferma a ${email.trim()}. Clicca sul link nella tua casella di posta e poi torna qui.`,
      );
      this.registrationInProgress = false;
      await this.handleFirebaseSignedIn(cred.user, { force: true });
    } catch (err) {
      this.registrationInProgress = false;
      this.authError.set(this.friendlyAuthError(err));
    } finally {
      this.registrationInProgress = false;
      this.authBusy.set(false);
    }
  }

  async refreshEmailVerificationStatus(silent = false): Promise<boolean> {
    const clients = getFirebaseClients();
    const currentUser = clients?.auth.currentUser;
    if (!currentUser) return false;

    if (!silent) {
      this.authBusy.set(true);
      this.authError.set(null);
      this.authNotice.set(null);
    }

    try {
      await reload(currentUser);
      if (currentUser.emailVerified) {
        // Force a fresh JWT ID token so Firestore rules immediately see email_verified == true
        await currentUser.getIdToken(true);
        await this.handleFirebaseSignedIn(currentUser, { force: true });
        return true;
      }
      if (!silent) {
        this.authError.set(
          'L’email non risulta ancora verificata. Controlla la posta (anche Spam/Promozioni) e clicca sul link di conferma.',
        );
      }
      return false;
    } catch (err) {
      if (!silent) {
        this.authError.set(this.friendlyAuthError(err));
      }
      return false;
    } finally {
      if (!silent) {
        this.authBusy.set(false);
      }
    }
  }

  async resendVerificationEmail(): Promise<void> {
    const clients = getFirebaseClients();
    const currentUser = clients?.auth.currentUser;
    if (!currentUser) return;

    const now = Date.now();
    const elapsedSec = Math.floor((now - this.lastVerificationResendMs) / 1000);
    if (elapsedSec < 30) {
      this.authNotice.set(
        `Attendi ancora ${30 - elapsedSec} secondi prima di richiedere una nuova email di verifica.`,
      );
      return;
    }

    this.authBusy.set(true);
    this.authError.set(null);
    this.authNotice.set(null);
    try {
      await sendEmailVerification(currentUser);
      this.lastVerificationResendMs = Date.now();
      this.authNotice.set(
        `Nuova email di verifica inviata a ${currentUser.email}. Controlla anche la cartella Spam.`,
      );
    } catch (err) {
      this.authError.set(this.friendlyAuthError(err));
    } finally {
      this.authBusy.set(false);
    }
  }

  async submitMfaChallenge(code: string): Promise<boolean> {
    const user = this.sessionUser();
    const config = this.mfaConfig();
    if (!user || !config || !this.mfaRepo) return false;

    this.authError.set(null);
    const result = await verifyMfaChallenge(config, code);
    if (!result.ok) {
      this.authError.set('Codice 2FA o codice di recupero non valido. Riprova.');
      return false;
    }

    if (result.method === 'backup_code' && result.remainingBackupCodeHashes) {
      await this.mfaRepo.consumeBackupCode(user.uid, result.remainingBackupCodeHashes);
      this.mfaConfig.set({
        ...config,
        backupCodeHashes: result.remainingBackupCodeHashes,
      });
      this.notify(
        'info',
        `Accesso verificato con codice di recupero (${result.remainingBackupCodeHashes.length} rimanenti).`,
      );
    }

    await this.unlockWorkspace(user);
    return true;
  }

  async logout(): Promise<void> {
    this.teardownSubscriptions();
    const user = this.sessionUser();
    this.sessionUser.set(null);
    this.mfaConfig.set(null);
    this.encryptionConfig.set(null);
    this.applyEncryptionKeyToRepos(null);
    this.pendingMfaDraft.set(null);
    this.mfaVerifiedForUid = null;
    this.unlockedUid = null;
    this.profileLoaded.set(false);
    this.goals.set([]);
    this.tips.set([]);
    this.roadmapItems.set([]);
    this.historyState.update((h) => clearHistory(h));
    this.authError.set(null);
    this.authNotice.set(null);

    if (user?.mode === 'firebase') {
      const clients = getFirebaseClients();
      if (clients) {
        await signOut(clients.auth);
      }
    }
    this.authStage.set('unauthenticated');
  }

  // ---------------------------------------------------------------------------
  // Goal CRUD (In-place Spreadsheet Editing — zero modals)
  // ---------------------------------------------------------------------------
  focusInlineNewRow(): void {
    this.activeTab.set('data');
    this.focusNewRowSignal.update((n) => n + 1);
  }

  async addGoal(input: GoalInput): Promise<{ ok: boolean; errors: readonly string[] }> {
    const check = validateGoalInput(input);
    if (!check.valid) {
      this.notify('error', check.errors[0] ?? 'Dati non validi.');
      return { ok: false, errors: check.errors };
    }
    const user = this.sessionUser();
    if (!user || !this.goalRepo) return { ok: false, errors: ['Sessione non attiva.'] };

    try {
      const nextOrder =
        this.goals().length > 0 ? Math.max(...this.goals().map((g) => g.sortOrder)) + 1 : 0;
      const created = await this.goalRepo.create(user.uid, input, nextOrder);
      this.recordHistory({
        kind: 'goal:create',
        goalId: created.id,
        input: {
          title: created.title,
          startDate: created.startDate,
          endDate: created.endDate,
          notes: created.notes,
        },
        sortOrder: created.sortOrder,
        label: `Aggiunta "${this.shortLabel(created.title)}"`,
      });
      return { ok: true, errors: [] };
    } catch (err) {
      const msg = this.friendlyError(err);
      this.notify('error', msg);
      return { ok: false, errors: [msg] };
    }
  }

  openSocialShare(enriched: EnrichedGoal): void {
    this.socialShareGoal.set(enriched);
  }

  openSocialShareById(goalId: string): void {
    const match = this.enrichedGoals().find((item) => item.goal.id === goalId) ?? null;
    if (match) {
      this.socialShareGoal.set(match);
    }
  }

  closeSocialShare(): void {
    this.socialShareGoal.set(null);
  }

  openImportModal(): void {
    this.importModalOpen.set(true);
  }

  closeImportModal(): void {
    this.importModalOpen.set(false);
  }

  async importGoalsBatch(
    inputs: readonly GoalInput[],
  ): Promise<{ ok: boolean; importedCount: number; error?: string }> {
    const user = this.sessionUser();
    if (!user || !this.goalRepo) {
      return { ok: false, importedCount: 0, error: 'Sessione non attiva.' };
    }
    if (inputs.length === 0) {
      return { ok: false, importedCount: 0, error: 'Nessuna attività valida da importare.' };
    }

    const baseOrder =
      this.goals().length > 0 ? Math.max(...this.goals().map((g) => g.sortOrder)) + 1 : 0;

    const createdItems: { goalId: string; input: GoalInput; sortOrder: number }[] = [];
    try {
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const check = validateGoalInput(input);
        if (!check.valid) continue;
        const created = await this.goalRepo.create(user.uid, input, baseOrder + i);
        createdItems.push({
          goalId: created.id,
          input: {
            title: created.title,
            startDate: created.startDate,
            endDate: created.endDate,
            notes: created.notes,
          },
          sortOrder: created.sortOrder,
        });
      }

      if (createdItems.length > 0) {
        this.recordHistory({
          kind: 'goal:batch-create',
          items: createdItems,
          label: `Importazione ${createdItems.length} attività`,
        });
        this.notify('success', `Importate ${createdItems.length} attività nel foglio.`);
      }
      return { ok: true, importedCount: createdItems.length };
    } catch (err) {
      const msg = this.friendlyError(err);
      this.notify('error', msg);
      return { ok: false, importedCount: createdItems.length, error: msg };
    }
  }

  async updateGoalInline(
    goalId: string,
    patch: Partial<GoalInput>,
  ): Promise<{ ok: boolean; errors: readonly string[] }> {
    const existing = this.goals().find((g) => g.id === goalId);
    if (!existing) return { ok: false, errors: ['Riga non trovata.'] };

    const before: GoalInput = {
      title: existing.title,
      startDate: existing.startDate,
      endDate: existing.endDate,
      notes: existing.notes,
    };

    const merged: GoalInput = {
      title: (patch.title !== undefined ? patch.title : existing.title).trim(),
      startDate: (patch.startDate !== undefined ? patch.startDate : existing.startDate).trim(),
      endDate: (patch.endDate !== undefined ? patch.endDate : existing.endDate).trim(),
      notes: (patch.notes !== undefined ? patch.notes : existing.notes).trim(),
    };

    // Avoid redundant writes when nothing actually changed
    if (
      merged.title === before.title &&
      merged.startDate === before.startDate &&
      merged.endDate === before.endDate &&
      merged.notes === before.notes
    ) {
      return { ok: true, errors: [] };
    }

    const check = validateGoalInput(merged);
    if (!check.valid) {
      this.notify('error', check.errors[0] ?? 'Valore non valido.');
      return { ok: false, errors: check.errors };
    }

    const user = this.sessionUser();
    if (!user || !this.goalRepo) return { ok: false, errors: ['Sessione non attiva.'] };

    try {
      await this.goalRepo.update(user.uid, goalId, patch);
      this.recordHistory({
        kind: 'goal:update',
        goalId,
        before,
        after: merged,
        label: `Modifica "${this.shortLabel(merged.title)}"`,
      });
      return { ok: true, errors: [] };
    } catch (err) {
      const msg = this.friendlyError(err);
      this.notify('error', msg);
      return { ok: false, errors: [msg] };
    }
  }

  async deleteGoal(goalId: string): Promise<void> {
    const user = this.sessionUser();
    if (!user || !this.goalRepo) return;
    const existing = this.goals().find((g) => g.id === goalId);
    try {
      await this.goalRepo.delete(user.uid, goalId);
      if (existing) {
        this.recordHistory({
          kind: 'goal:delete',
          goalId: existing.id,
          input: {
            title: existing.title,
            startDate: existing.startDate,
            endDate: existing.endDate,
            notes: existing.notes,
          },
          sortOrder: existing.sortOrder,
          label: `Eliminazione "${this.shortLabel(existing.title)}"`,
        });
      }
    } catch (err) {
      this.notify('error', this.friendlyError(err));
    }
  }

  async loadSampleDataIntoAccount(): Promise<void> {
    const user = this.sessionUser();
    if (!user || !this.goalRepo || !this.tipRepo || !this.roadmapRepo) return;

    if (user.mode === 'demo' && this.localStore) {
      this.localStore.resetToSeed();
      this.notify('success', 'Dati di esempio ripristinati.');
      return;
    }

    try {
      const seed = buildSeedDataset(user.uid, this.referenceDateIso());
      const createdIdMap = new Map<string, string>();
      let order = this.goals().length;
      for (const g of seed.goals) {
        const created = await this.goalRepo.create(
          user.uid,
          {
            title: g.title,
            startDate: g.startDate,
            endDate: g.endDate,
            notes: g.notes,
          },
          order++,
        );
        createdIdMap.set(g.id, created.id);
      }
      for (const t of seed.tips) {
        const mappedGoalId = createdIdMap.get(t.goalId);
        if (mappedGoalId) {
          await this.tipRepo.create(user.uid, {
            goalId: mappedGoalId,
            nextStep: t.nextStep,
          });
        }
      }
      for (const r of seed.roadmap) {
        await this.roadmapRepo.create(user.uid, r.text, r.done);
      }
      this.notify('success', 'Dati di esempio caricati nel tuo database Firebase.');
    } catch (err) {
      this.notify('error', this.friendlyError(err));
    }
  }

  // ---------------------------------------------------------------------------
  // Memo CRUD (stored in /users/{uid}/tips)
  // ---------------------------------------------------------------------------
  async addTip(input: TipInput): Promise<boolean> {
    const user = this.sessionUser();
    if (!user || !this.tipRepo) return false;
    if (!input.goalId || !input.nextStep.trim()) return false;
    try {
      const created = await this.tipRepo.create(user.uid, input);
      this.recordHistory({
        kind: 'tip:create',
        tipId: created.id,
        input: { goalId: created.goalId, nextStep: created.nextStep },
        done: created.done,
        label: `Nuovo memo "${this.shortLabel(created.nextStep)}"`,
      });
      return true;
    } catch (err) {
      this.notify('error', this.friendlyError(err));
      return false;
    }
  }

  async toggleTipDone(tip: TipNote): Promise<void> {
    await this.updateTip(tip.id, { done: !tip.done });
  }

  async updateTip(tipId: string, patch: Partial<TipInput & { done: boolean }>): Promise<void> {
    const user = this.sessionUser();
    if (!user || !this.tipRepo) return;
    const existing = this.tips().find((t) => t.id === tipId);
    if (!existing) return;

    const before = { goalId: existing.goalId, nextStep: existing.nextStep, done: existing.done };
    const after = {
      goalId: patch.goalId ?? existing.goalId,
      nextStep: patch.nextStep !== undefined ? patch.nextStep.trim() : existing.nextStep,
      done: patch.done ?? existing.done,
    };
    if (
      before.goalId === after.goalId &&
      before.nextStep === after.nextStep &&
      before.done === after.done
    ) {
      return;
    }

    try {
      await this.tipRepo.update(user.uid, tipId, patch);
      this.recordHistory({
        kind: 'tip:update',
        tipId,
        before,
        after,
        label: `Modifica memo "${this.shortLabel(after.nextStep)}"`,
      });
    } catch (err) {
      this.notify('error', this.friendlyError(err));
    }
  }

  async deleteTip(tipId: string): Promise<void> {
    const user = this.sessionUser();
    if (!user || !this.tipRepo) return;
    const existing = this.tips().find((t) => t.id === tipId);
    try {
      await this.tipRepo.delete(user.uid, tipId);
      if (existing) {
        this.recordHistory({
          kind: 'tip:delete',
          tipId: existing.id,
          input: { goalId: existing.goalId, nextStep: existing.nextStep },
          done: existing.done,
          label: `Eliminazione memo "${this.shortLabel(existing.nextStep)}"`,
        });
      }
    } catch (err) {
      this.notify('error', this.friendlyError(err));
    }
  }

  // ---------------------------------------------------------------------------
  // NEXT Roadmap CRUD
  // ---------------------------------------------------------------------------
  async addRoadmapItem(text: string): Promise<boolean> {
    const user = this.sessionUser();
    if (!user || !this.roadmapRepo || !text.trim()) return false;
    try {
      const created = await this.roadmapRepo.create(user.uid, text.trim(), false);
      this.recordHistory({
        kind: 'roadmap:create',
        itemId: created.id,
        text: created.text,
        done: created.done,
        label: `Nuova voce NEXT "${this.shortLabel(created.text)}"`,
      });
      return true;
    } catch (err) {
      this.notify('error', this.friendlyError(err));
      return false;
    }
  }

  async toggleRoadmapItem(item: RoadmapItem): Promise<void> {
    await this.updateRoadmapItem(item.id, { done: !item.done });
  }

  async updateRoadmapItem(itemId: string, patch: { text?: string; done?: boolean }): Promise<void> {
    const user = this.sessionUser();
    if (!user || !this.roadmapRepo) return;
    const existing = this.roadmapItems().find((r) => r.id === itemId);
    if (!existing) return;

    const before = { text: existing.text, done: existing.done };
    const after = {
      text: patch.text !== undefined ? patch.text.trim() : existing.text,
      done: patch.done ?? existing.done,
    };
    if (before.text === after.text && before.done === after.done) return;

    try {
      await this.roadmapRepo.update(user.uid, itemId, patch);
      this.recordHistory({
        kind: 'roadmap:update',
        itemId,
        before,
        after,
        label: `Modifica NEXT "${this.shortLabel(after.text)}"`,
      });
    } catch (err) {
      this.notify('error', this.friendlyError(err));
    }
  }

  async deleteRoadmapItem(itemId: string): Promise<void> {
    const user = this.sessionUser();
    if (!user || !this.roadmapRepo) return;
    const existing = this.roadmapItems().find((r) => r.id === itemId);
    try {
      await this.roadmapRepo.delete(user.uid, itemId);
      if (existing) {
        this.recordHistory({
          kind: 'roadmap:delete',
          itemId: existing.id,
          text: existing.text,
          done: existing.done,
          label: `Eliminazione NEXT "${this.shortLabel(existing.text)}"`,
        });
      }
    } catch (err) {
      this.notify('error', this.friendlyError(err));
    }
  }

  // ---------------------------------------------------------------------------
  // Undo / Redo Execution (Ctrl+Z / Ctrl+Y)
  // ---------------------------------------------------------------------------
  async undo(): Promise<boolean> {
    if (this.historyBusy()) return false;
    const user = this.sessionUser();
    if (!user) return false;

    const { entry, nextState } = popUndo(this.historyState());
    if (!entry) return false;

    this.historyBusy.set(true);
    this.historyState.set(nextState);
    try {
      await this.applyHistoryCommand(user.uid, entry, 'undo');
      this.notify('info', `Annullato: ${entry.label}`);
      return true;
    } catch (err) {
      this.notify('error', this.friendlyError(err));
      return false;
    } finally {
      this.historyBusy.set(false);
    }
  }

  async redo(): Promise<boolean> {
    if (this.historyBusy()) return false;
    const user = this.sessionUser();
    if (!user) return false;

    const { entry, nextState } = popRedo(this.historyState());
    if (!entry) return false;

    this.historyBusy.set(true);
    this.historyState.set(nextState);
    try {
      await this.applyHistoryCommand(user.uid, entry, 'redo');
      this.notify('info', `Ripristinato: ${entry.label}`);
      return true;
    } catch (err) {
      this.notify('error', this.friendlyError(err));
      return false;
    } finally {
      this.historyBusy.set(false);
    }
  }

  private recordHistory(cmd: UndoCommand): void {
    this.historyState.update((curr) => pushHistory(curr, cmd));
  }

  private remapEntityId(kind: 'goal' | 'tip' | 'roadmap', oldId: string, newId: string): void {
    if (oldId === newId) return;
    this.historyState.update((curr) =>
      mapHistoryEntries(curr, (entry) => {
        if (kind === 'goal') {
          if (
            (entry.kind === 'goal:create' ||
              entry.kind === 'goal:update' ||
              entry.kind === 'goal:delete') &&
            entry.goalId === oldId
          ) {
            return { ...entry, goalId: newId };
          }
          if (entry.kind === 'goal:batch-create') {
            let changed = false;
            const nextItems = entry.items.map((item) => {
              if (item.goalId === oldId) {
                changed = true;
                return { ...item, goalId: newId };
              }
              return item;
            });
            if (changed) {
              return { ...entry, items: nextItems };
            }
          }
          if (entry.kind === 'tip:create' || entry.kind === 'tip:delete') {
            if (entry.input.goalId === oldId) {
              return { ...entry, input: { ...entry.input, goalId: newId } };
            }
          }
        } else if (kind === 'tip') {
          if (
            (entry.kind === 'tip:create' ||
              entry.kind === 'tip:update' ||
              entry.kind === 'tip:delete') &&
            entry.tipId === oldId
          ) {
            return { ...entry, tipId: newId };
          }
        } else if (kind === 'roadmap') {
          if (
            (entry.kind === 'roadmap:create' ||
              entry.kind === 'roadmap:update' ||
              entry.kind === 'roadmap:delete') &&
            entry.itemId === oldId
          ) {
            return { ...entry, itemId: newId };
          }
        }
        return entry;
      }),
    );
  }

  private async applyHistoryCommand(
    ownerId: string,
    cmd: UndoCommand,
    direction: 'undo' | 'redo',
  ): Promise<void> {
    switch (cmd.kind) {
      case 'goal:create': {
        if (!this.goalRepo) return;
        if (direction === 'undo') {
          await this.goalRepo.delete(ownerId, cmd.goalId);
        } else {
          const recreated = await this.goalRepo.create(ownerId, cmd.input, cmd.sortOrder);
          this.remapEntityId('goal', cmd.goalId, recreated.id);
        }
        return;
      }
      case 'goal:update': {
        if (!this.goalRepo) return;
        const target = direction === 'undo' ? cmd.before : cmd.after;
        await this.goalRepo.update(ownerId, cmd.goalId, target);
        return;
      }
      case 'goal:delete': {
        if (!this.goalRepo) return;
        if (direction === 'undo') {
          const recreated = await this.goalRepo.create(ownerId, cmd.input, cmd.sortOrder);
          this.remapEntityId('goal', cmd.goalId, recreated.id);
        } else {
          await this.goalRepo.delete(ownerId, cmd.goalId);
        }
        return;
      }
      case 'goal:batch-create': {
        if (!this.goalRepo) return;
        if (direction === 'undo') {
          for (const item of cmd.items) {
            await this.goalRepo.delete(ownerId, item.goalId);
          }
        } else {
          for (const item of cmd.items) {
            const recreated = await this.goalRepo.create(ownerId, item.input, item.sortOrder);
            this.remapEntityId('goal', item.goalId, recreated.id);
          }
        }
        return;
      }
      case 'tip:create': {
        if (!this.tipRepo) return;
        if (direction === 'undo') {
          await this.tipRepo.delete(ownerId, cmd.tipId);
        } else {
          const recreated = await this.tipRepo.create(ownerId, cmd.input);
          if (cmd.done) {
            await this.tipRepo.update(ownerId, recreated.id, { done: true });
          }
          this.remapEntityId('tip', cmd.tipId, recreated.id);
        }
        return;
      }
      case 'tip:update': {
        if (!this.tipRepo) return;
        const target = direction === 'undo' ? cmd.before : cmd.after;
        await this.tipRepo.update(ownerId, cmd.tipId, target);
        return;
      }
      case 'tip:delete': {
        if (!this.tipRepo) return;
        if (direction === 'undo') {
          const recreated = await this.tipRepo.create(ownerId, cmd.input);
          if (cmd.done) {
            await this.tipRepo.update(ownerId, recreated.id, { done: true });
          }
          this.remapEntityId('tip', cmd.tipId, recreated.id);
        } else {
          await this.tipRepo.delete(ownerId, cmd.tipId);
        }
        return;
      }
      case 'roadmap:create': {
        if (!this.roadmapRepo) return;
        if (direction === 'undo') {
          await this.roadmapRepo.delete(ownerId, cmd.itemId);
        } else {
          const recreated = await this.roadmapRepo.create(ownerId, cmd.text, cmd.done);
          this.remapEntityId('roadmap', cmd.itemId, recreated.id);
        }
        return;
      }
      case 'roadmap:update': {
        if (!this.roadmapRepo) return;
        const target = direction === 'undo' ? cmd.before : cmd.after;
        await this.roadmapRepo.update(ownerId, cmd.itemId, target);
        return;
      }
      case 'roadmap:delete': {
        if (!this.roadmapRepo) return;
        if (direction === 'undo') {
          const recreated = await this.roadmapRepo.create(ownerId, cmd.text, cmd.done);
          this.remapEntityId('roadmap', cmd.itemId, recreated.id);
        } else {
          await this.roadmapRepo.delete(ownerId, cmd.itemId);
        }
        return;
      }
    }
  }

  private shortLabel(text: string): string {
    const clean = text.trim();
    return clean.length > 32 ? `${clean.slice(0, 32)}…` : clean;
  }

  // ---------------------------------------------------------------------------
  // Profile, Thresholds & Palette Offset
  // ---------------------------------------------------------------------------
  async updateProfilePatch(
    patch: Partial<{
      displayName: string;
      paletteStartRow: number;
      thresholds: RecurrenceThresholds;
    }>,
  ): Promise<void> {
    const user = this.sessionUser();
    const updated: UserProfile = {
      ...this.profile(),
      ...patch,
      thresholds: patch.thresholds ? { ...patch.thresholds } : this.profile().thresholds,
    };
    this.profile.set(updated);

    if (user && patch.displayName) {
      this.sessionUser.set({ ...user, displayName: updated.displayName });
    }

    if (user && this.profileRepo) {
      try {
        await this.profileRepo.update(user.uid, updated);
      } catch (err) {
        this.notify('error', this.friendlyError(err));
      }
    }
  }

  async updateDisplayName(rawName: string): Promise<{ ok: boolean; error?: string }> {
    const check = validateDisplayName(rawName);
    if (!check.valid) {
      return { ok: false, error: check.error ?? 'Nome non valido.' };
    }

    const user = this.sessionUser();
    if (!user) return { ok: false, error: 'Sessione non attiva.' };

    const updated: UserProfile = {
      ...this.profile(),
      displayName: check.sanitized,
    };

    try {
      if (this.profileRepo) {
        await this.profileRepo.update(user.uid, updated);
      }
      if (user.mode === 'firebase') {
        const clients = getFirebaseClients();
        if (clients?.auth.currentUser) {
          await updateProfile(clients.auth.currentUser, { displayName: check.sanitized });
        }
      }
      this.profile.set(updated);
      this.sessionUser.set({ ...user, displayName: check.sanitized });
      this.notify('success', `Nome aggiornato: CronoSheet di ${check.sanitized}`);
      return { ok: true };
    } catch (err) {
      const msg = this.friendlyError(err);
      this.notify('error', msg);
      return { ok: false, error: msg };
    }
  }

  // ---------------------------------------------------------------------------
  // 2FA / MFA TOTP Management
  // ---------------------------------------------------------------------------
  beginMfaEnrollment(): MfaEnrollmentDraft {
    const label = this.sessionUser()?.email || 'utente@cronosheet.app';
    const draft = createMfaEnrollmentDraft(label);
    this.pendingMfaDraft.set(draft);
    return draft;
  }

  cancelMfaEnrollment(): void {
    this.pendingMfaDraft.set(null);
  }

  async confirmMfaEnrollment(code: string): Promise<{ ok: boolean; error?: string }> {
    const user = this.sessionUser();
    const draft = this.pendingMfaDraft();
    if (!user || !draft || !this.mfaRepo) {
      return { ok: false, error: 'Nessuna configurazione 2FA attiva.' };
    }

    const res = await finalizeMfaEnrollment(user.uid, draft, code);
    if (!res.ok || !res.config) {
      return { ok: false, error: 'Codice TOTP a 6 cifre non valido. Verifica l’orario o riscansiona il QR.' };
    }

    try {
      await this.mfaRepo.save(user.uid, res.config);
      this.mfaConfig.set(res.config);
      this.pendingMfaDraft.set(null);
      this.notify('success', 'Autenticazione a due fattori (2FA TOTP) attivata con successo.');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.friendlyError(err) };
    }
  }

  async disableMfa(): Promise<void> {
    const user = this.sessionUser();
    if (!user || !this.mfaRepo) return;
    const disabled: UserMfaSecurity = {
      ownerId: user.uid,
      totpEnabled: false,
      totpSecret: '',
      backupCodeHashes: [],
      enrolledAtIso: null,
    };
    try {
      await this.mfaRepo.save(user.uid, disabled);
      this.mfaConfig.set(disabled);
      this.notify('info', 'Autenticazione a due fattori (2FA) disattivata.');
    } catch (err) {
      this.notify('error', this.friendlyError(err));
    }
  }

  lockSessionForMfaTest(): void {
    const config = this.mfaConfig();
    if (config?.totpEnabled) {
      this.mfaVerifiedForUid = null;
      this.authStage.set('mfa_required');
    }
  }

  // ---------------------------------------------------------------------------
  // Standard AES-256-GCM Data Encryption (Opt-in, max 2 mode switches / month)
  // ---------------------------------------------------------------------------
  private applyEncryptionKeyToRepos(key: CryptoKey | null): void {
    this.goalRepo?.setEncryptionKey?.(key);
    this.tipRepo?.setEncryptionKey?.(key);
    this.roadmapRepo?.setEncryptionKey?.(key);
  }

  async setDataEncryptionEnabled(
    enable: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    const user = this.sessionUser();
    if (!user || !this.encryptionRepo || !this.goalRepo || !this.tipRepo || !this.roadmapRepo) {
      return { ok: false, error: 'Sessione non attiva.' };
    }
    if (this.encryptionBusy()) {
      return { ok: false, error: 'Operazione già in corso.' };
    }

    const current = this.encryptionConfig();
    if (Boolean(current?.enabled) === enable) {
      return { ok: true };
    }

    const currentMonth = getCurrentYearMonth();
    const quota = getEncryptionSwitchQuota(current, currentMonth);
    if (!quota.canSwitch) {
      return {
        ok: false,
        error: `Limite mensile raggiunto (${quota.limit}/${quota.limit} cambi in ${currentMonth}). Potrai cambiare di nuovo il mese prossimo.`,
      };
    }

    this.encryptionBusy.set(true);
    try {
      // Snapshot current decrypted items before changing repository encryption state
      const currentGoals = [...this.goals()];
      const currentTips = [...this.tips()];
      const currentRoadmap = [...this.roadmapItems()];

      const keyMaterial =
        current?.keyMaterial && current.keyMaterial.length >= 32
          ? current.keyMaterial
          : generateAes256KeyMaterial();

      const targetKey = enable ? await importAes256Key(keyMaterial) : null;
      const nextConfig: UserEncryptionSecurity = {
        ownerId: user.uid,
        enabled: enable,
        algorithm: ENCRYPTION_ALGORITHM,
        keyMaterial,
        switchesMonth: currentMonth,
        switchesThisMonth: quota.used + 1,
        enabledAtIso: new Date().toISOString(),
      };

      // Persist config first, then switch repo key and rewrite existing documents
      await this.encryptionRepo.save(user.uid, nextConfig);
      this.applyEncryptionKeyToRepos(targetKey);

      for (const goal of currentGoals) {
        await this.goalRepo.update(user.uid, goal.id, {
          title: goal.title,
          notes: goal.notes,
        });
      }
      for (const tip of currentTips) {
        await this.tipRepo.update(user.uid, tip.id, {
          nextStep: tip.nextStep,
        });
      }
      for (const item of currentRoadmap) {
        await this.roadmapRepo.update(user.uid, item.id, {
          text: item.text,
        });
      }

      this.encryptionConfig.set(nextConfig);
      this.notify(
        'success',
        enable
          ? 'Crittografia AES-256-GCM attivata: tutti i tuoi dati sono ora cifrati nel database.'
          : 'Crittografia disattivata: i tuoi dati sono stati ripristinati in chiaro nel database.',
      );
      return { ok: true };
    } catch (err) {
      const msg = this.friendlyError(err);
      this.notify('error', msg);
      return { ok: false, error: msg };
    } finally {
      this.encryptionBusy.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Shareable Message Language (EN / IT / ES infinitive support)
  // ---------------------------------------------------------------------------
  setMessageLanguage(lang: MessageLanguage): void {
    this.messageLanguage.set(lang);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cronosheet_msg_lang_v1', lang);
      } catch {
        // Ignore storage errors
      }
    }
  }

  private loadInitialMessageLanguage(): MessageLanguage {
    if (typeof window === 'undefined') return 'en';
    try {
      const stored = window.localStorage.getItem('cronosheet_msg_lang_v1');
      if (stored === 'it' || stored === 'en' || stored === 'es') {
        return stored;
      }
    } catch {
      // Ignore storage errors
    }
    return 'en';
  }

  // ---------------------------------------------------------------------------
  // FilterSort & CSV Export
  // ---------------------------------------------------------------------------
  updateFilterCriteria(patch: Partial<GoalFilterCriteria>): void {
    this.filterCriteria.update((curr) => ({ ...curr, ...patch }));
  }

  resetFilterCriteria(): void {
    this.filterCriteria.set({
      search: '',
      completion: 'all',
      sortKey: 'sortOrder',
      sortDir: 'asc',
    });
  }

  downloadCsv(useFiltered: boolean): void {
    if (typeof window === 'undefined') return;
    const rows = useFiltered ? this.filteredGoals() : this.enrichedGoals();
    const csv = exportGoalsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cronosheet_${useFiltered ? 'filtersort' : 'data'}_${this.referenceDateIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify('success', `Esportate ${rows.length} righe in CSV.`);
  }

  downloadJsonBackup(): void {
    if (typeof window === 'undefined') return;
    const json = exportWorkspaceBackupJson(
      this.goals(),
      this.tips(),
      this.roadmapItems(),
      this.referenceDateIso(),
    );
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cronosheet_backup_${this.referenceDateIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify('success', `Backup JSON esportato (${this.goals().length} attività).`);
  }

  clearBanner(): void {
    this.statusBanner.set(null);
  }

  private notify(tone: 'info' | 'success' | 'error', text: string): void {
    this.statusBanner.set({ tone, text });
  }

  private teardownSubscriptions(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  private friendlyError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('Quota exceeded')) {
      return 'Quota giornaliera gratuita di Firestore raggiunta. Si ripristinerà domani.';
    }
    if (raw.includes('Missing or insufficient permissions') || raw.includes('permission-denied')) {
      return 'Permessi insufficienti: verifica di aver confermato la tua email e di essere autenticato.';
    }
    return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
  }

  private friendlyAuthError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/operation-not-allowed')) {
      return 'Il provider Email/Password va abilitato nella Firebase Console (Authentication → Sign-in method). Puoi usare subito Accedi con Google o Modalità Demo.';
    }
    if (raw.includes('auth/popup-closed-by-user') || raw.includes('auth/cancelled-popup-request')) {
      return 'Accesso con Google annullato. Puoi riprovare quando vuoi.';
    }
    if (raw.includes('auth/popup-blocked')) {
      return 'Il browser ha bloccato il popup di accesso Google. Consenti i popup per questo sito e riprova.';
    }
    if (isFirebasePopupAssertionRace(err)) {
      return 'La finestra di accesso Google è stata interrotta. Riprova.';
    }
    if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
      return 'Credenziali non valide. Controlla email e password.';
    }
    if (raw.includes('auth/email-already-in-use')) {
      return 'Esiste già un account con questa email.';
    }
    if (raw.includes('auth/weak-password')) {
      return 'La password deve contenere almeno 6 caratteri.';
    }
    if (raw.includes('auth/too-many-requests')) {
      return 'Troppi tentativi ravvicinati. Attendi qualche minuto e riprova.';
    }
    return this.friendlyError(err);
  }
}
