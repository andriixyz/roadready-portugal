import { SUPABASE_CONFIG } from "./supabase-config.js";

const TABLE = "roadready_profiles";
const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const LAST_SYNC_KEY = "roadready-last-sync";
const SYNC_DELAY_MS = 1200;

const clone = (value) => JSON.parse(JSON.stringify(value));
const timestamp = (value) => {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
};
const laterValue = (localValue, cloudValue, localUpdatedAt, cloudUpdatedAt) => (
  timestamp(localUpdatedAt) >= timestamp(cloudUpdatedAt) ? localValue : cloudValue
);
const sessionKey = (item) => item.id || [
  item.completedAt,
  item.mode,
  item.correct,
  item.total,
  item.durationSeconds,
].join("|");

export function mergeProfiles(localProfile = {}, cloudProfile = {}) {
  const local = clone(localProfile || {});
  const cloud = clone(cloudProfile || {});
  const localUpdatedAt = local.updatedAt;
  const cloudUpdatedAt = cloud.updatedAt;
  const newest = timestamp(localUpdatedAt) >= timestamp(cloudUpdatedAt) ? local : cloud;

  const questionProgress = {};
  const questionIds = new Set([
    ...Object.keys(cloud.questionProgress || {}),
    ...Object.keys(local.questionProgress || {}),
  ]);

  questionIds.forEach((questionId) => {
    const localItem = local.questionProgress?.[questionId];
    const cloudItem = cloud.questionProgress?.[questionId];
    if (!localItem || !cloudItem) {
      questionProgress[questionId] = clone(localItem || cloudItem);
      return;
    }

    const localIsNewest = timestamp(localItem.lastAnswer) >= timestamp(cloudItem.lastAnswer);
    const recent = localIsNewest ? localItem : cloudItem;
    const older = localIsNewest ? cloudItem : localItem;
    questionProgress[questionId] = {
      ...older,
      ...recent,
      correct: Math.max(localItem.correct || 0, cloudItem.correct || 0),
      wrong: Math.max(localItem.wrong || 0, cloudItem.wrong || 0),
    };
  });

  const sessions = new Map();
  [...(cloud.sessions || []), ...(local.sessions || [])].forEach((item) => {
    if (!item?.completedAt) return;
    sessions.set(sessionKey(item), clone(item));
  });

  const startedAtCandidates = [local.startedAt, cloud.startedAt]
    .filter(Boolean)
    .sort((a, b) => timestamp(a) - timestamp(b));
  const updatedAtCandidates = [localUpdatedAt, cloudUpdatedAt]
    .filter(Boolean)
    .sort((a, b) => timestamp(b) - timestamp(a));

  return {
    ...cloud,
    ...local,
    startedAt: startedAtCandidates[0] || new Date().toISOString(),
    updatedAt: updatedAtCandidates[0] || new Date().toISOString(),
    dailyGoal: laterValue(local.dailyGoal, cloud.dailyGoal, localUpdatedAt, cloudUpdatedAt) ?? 20,
    language: laterValue(local.language, cloud.language, localUpdatedAt, cloudUpdatedAt) || "en",
    uiLanguage: laterValue(local.uiLanguage, cloud.uiLanguage, localUpdatedAt, cloudUpdatedAt) || local.uiLanguage || cloud.uiLanguage || "en",
    streak: Math.max(local.streak || 1, cloud.streak || 1),
    questionProgress,
    sessions: [...sessions.values()]
      .sort((a, b) => timestamp(a.completedAt) - timestamp(b.completedAt))
      .slice(-100),
    ...Object.fromEntries(
      Object.entries(newest).filter(([key]) => ![
        "startedAt",
        "updatedAt",
        "dailyGoal",
        "language",
        "uiLanguage",
        "streak",
        "questionProgress",
        "sessions",
      ].includes(key)),
    ),
  };
}

export function createSyncController({ getProfile, applyProfile, onStateChange }) {
  let client = null;
  let user = null;
  let syncTimer = null;
  let syncing = false;
  let pending = false;
  let initializePromise = null;
  let authSubscription = null;

  let state = {
    configured: Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey),
    status: "local",
    user: null,
    lastSyncedAt: localStorage.getItem(LAST_SYNC_KEY),
    messageKey: "sync.signInShare",
  };

  const emit = (patch = {}) => {
    state = { ...state, ...patch, user };
    onStateChange?.({ ...state });
  };

  const setSignedOutState = () => {
    user = null;
    emit({
      status: navigator.onLine ? "local" : "offline",
      messageKey: navigator.onLine ? "sync.signInShare" : "sync.offlineSaved",
    });
  };

  const initializeClient = async () => {
    if (!state.configured) {
      emit({
        status: "unconfigured",
        messageKey: "sync.notConfigured",
      });
      return state;
    }

    emit({ status: "connecting", messageKey: "sync.connectingSecurely" });
    try {
      const { createClient } = await import(SDK_URL);
      client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });

      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        queueMicrotask(async () => {
          const nextUser = session?.user || null;
          if (!nextUser) {
            setSignedOutState();
            return;
          }
          const changedUser = user?.id !== nextUser.id;
          user = nextUser;
          emit({
            status: changedUser ? "connecting" : state.status,
            messageKey: changedUser ? "sync.loadingCloud" : state.messageKey,
          });
          if (changedUser) await syncNow();
        });
      });
      authSubscription = listener?.subscription || null;

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      user = data.session?.user || null;
      if (user) await syncNow();
      else setSignedOutState();
    } catch (error) {
      emit({
        status: navigator.onLine ? "error" : "offline",
        messageKey: navigator.onLine ? "sync.startError" : "sync.offlineWillSync",
        error: error?.message,
      });
    }
    return state;
  };

  const initialize = () => {
    if (!initializePromise) initializePromise = initializeClient();
    return initializePromise;
  };

  const requestMagicLink = async (email) => {
    if (!client) await initialize();
    if (!client) throw new Error("Cloud sync is not configured yet.");

    emit({ status: "connecting", messageKey: "sync.sendingLink" });
    const redirectUrl = `${location.origin}${location.pathname}`;
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true,
      },
    });
    if (error) {
      emit({ status: "error", messageKey: "sync.signInSendError", error: error.message });
      throw error;
    }
    emit({
      status: "email-sent",
      messageKey: "sync.checkEmailDevice",
    });
  };

  async function syncNow() {
    clearTimeout(syncTimer);
    syncTimer = null;

    if (!client || !user) {
      pending = false;
      setSignedOutState();
      return false;
    }
    if (!navigator.onLine) {
      pending = true;
      emit({
        status: "offline",
        messageKey: "sync.offlineAuto",
      });
      return false;
    }
    if (syncing) {
      pending = true;
      return false;
    }

    syncing = true;
    pending = false;
    emit({ status: "syncing", messageKey: "sync.syncing" });
    try {
      const { data, error: readError } = await client
        .from(TABLE)
        .select("profile, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (readError) throw readError;

      const cloudProfile = data?.profile
        ? { ...data.profile, updatedAt: data.profile.updatedAt || data.updated_at }
        : {};
      // Read local state again after the network request so an answer recorded
      // while the fetch was in flight can never be overwritten by the merge.
      const merged = mergeProfiles(getProfile(), cloudProfile);
      if (JSON.stringify(merged) !== JSON.stringify(getProfile())) applyProfile(merged);

      const syncedAt = new Date().toISOString();
      const { error: writeError } = await client.from(TABLE).upsert({
        user_id: user.id,
        profile: merged,
        updated_at: syncedAt,
      }, { onConflict: "user_id" });
      if (writeError) throw writeError;

      localStorage.setItem(LAST_SYNC_KEY, syncedAt);
      emit({
        status: "synced",
        lastSyncedAt: syncedAt,
        messageKey: "sync.upToDate",
        error: null,
      });
    } catch (error) {
      pending = true;
      const setupMissing = error?.code === "42P01" || /roadready_profiles/i.test(error?.message || "");
      emit({
        status: navigator.onLine ? "error" : "offline",
        messageKey: setupMissing ? "sync.setupDatabase" : navigator.onLine ? "sync.paused" : "sync.offlineWillSync",
        error: error?.message,
      });
    } finally {
      syncing = false;
      if (pending && navigator.onLine && user) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(syncNow, SYNC_DELAY_MS);
      }
    }
    return state.status === "synced";
  }

  const schedule = () => {
    if (!user) return;
    pending = true;
    emit({
      status: navigator.onLine ? "pending" : "offline",
      messageKey: navigator.onLine ? "sync.savedQueued" : "sync.savedLater",
    });
    clearTimeout(syncTimer);
    if (navigator.onLine) syncTimer = setTimeout(syncNow, SYNC_DELAY_MS);
  };

  const signOut = async () => {
    clearTimeout(syncTimer);
    if (client && user && navigator.onLine) await syncNow();
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
    setSignedOutState();
  };

  const getState = () => ({ ...state, user });

  window.addEventListener("online", () => {
    if (user) syncNow();
    else emit({ status: "local", messageKey: "sync.signInShare" });
  });
  window.addEventListener("offline", () => emit({
    status: "offline",
    messageKey: "sync.offlineSaved",
  }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && user && navigator.onLine) syncNow();
  });

  return {
    initialize,
    requestMagicLink,
    schedule,
    syncNow,
    signOut,
    getState,
    destroy() {
      clearTimeout(syncTimer);
      authSubscription?.unsubscribe();
    },
  };
}
