import { SUPABASE_CONFIG } from "./supabase-config.js";
import { mergeAnswerActivity } from "./study-activity.js?v=20261002-2";

const SYNC_KEY_STORAGE = "roadready-sync-key";
const DEVICE_KEY_STORAGE = "roadready-device-id";
const LAST_SYNC_KEY = "roadready-last-sync";
const SYNC_DELAY_MS = 1200;
const clone = (value) => JSON.parse(JSON.stringify(value));
const timestamp = (value) => Number.isFinite(Date.parse(value || "")) ? Date.parse(value) : 0;
const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const laterValue = (local, cloud, localAt, cloudAt) => timestamp(localAt) >= timestamp(cloudAt) ? local : cloud;
const sessionKey = (item) => item.id || [item.completedAt, item.mode, item.correct, item.total, item.durationSeconds].join("|");

export const isValidSyncKey = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export function generateSyncKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function getDeviceId(storage = localStorage) {
  let id = storage.getItem(DEVICE_KEY_STORAGE);
  if (!id) {
    id = crypto.randomUUID();
    storage.setItem(DEVICE_KEY_STORAGE, id);
  }
  return id;
}

function answerCounts(item = {}) {
  const devices = item.countsByDevice || {};
  const baseCorrect = count(item.baseCorrect ?? (item.countsByDevice ? 0 : item.correct));
  const baseWrong = count(item.baseWrong ?? (item.countsByDevice ? 0 : item.wrong));
  return {
    baseCorrect, baseWrong, countsByDevice: clone(devices),
    correct: baseCorrect + Object.values(devices).reduce((total, value) => total + count(value.correct), 0),
    wrong: baseWrong + Object.values(devices).reduce((total, value) => total + count(value.wrong), 0),
  };
}

export function incrementAnswerCounts(item, isCorrect, deviceId) {
  const counters = answerCounts(item);
  const device = counters.countsByDevice[deviceId] || {};
  counters.countsByDevice[deviceId] = {
    correct: count(device.correct) + (isCorrect ? 1 : 0),
    wrong: count(device.wrong) + (isCorrect ? 0 : 1),
  };
  return { ...item, ...answerCounts(counters) };
}

function mergeQuestionProgress(local, cloud) {
  const localIsNewest = timestamp(local.lastAnswer) >= timestamp(cloud.lastAnswer);
  const recent = localIsNewest ? local : cloud;
  const older = localIsNewest ? cloud : local;
  if (!local.countsByDevice && !cloud.countsByDevice) {
    return { ...older, ...recent, correct: Math.max(count(local.correct), count(cloud.correct)), wrong: Math.max(count(local.wrong), count(cloud.wrong)) };
  }
  const a = answerCounts(local), b = answerCounts(cloud);
  const devices = Object.fromEntries([...new Set([...Object.keys(a.countsByDevice), ...Object.keys(b.countsByDevice)])].sort().map(id => [id, {
    correct: Math.max(count(a.countsByDevice[id]?.correct), count(b.countsByDevice[id]?.correct)),
    wrong: Math.max(count(a.countsByDevice[id]?.wrong), count(b.countsByDevice[id]?.wrong)),
  }]));
  return { ...older, ...recent, ...answerCounts({ baseCorrect: Math.max(a.baseCorrect, b.baseCorrect), baseWrong: Math.max(a.baseWrong, b.baseWrong), countsByDevice: devices }) };
}

export function mergeProfiles(localProfile = {}, cloudProfile = {}) {
  let local = clone(localProfile || {}), cloud = clone(cloudProfile || {});
  // A reset is a new history generation. Stale devices must not restore erased results.
  if (timestamp(local.resetAt) > timestamp(cloud.resetAt)) {
    cloud = { ...cloud, questionProgress: {}, sessions: [], answerActivity: {}, streak: 0, startedAt: local.startedAt, resetAt: local.resetAt };
  } else if (timestamp(cloud.resetAt) > timestamp(local.resetAt)) {
    local = { ...local, questionProgress: {}, sessions: [], answerActivity: {}, streak: 0, startedAt: cloud.startedAt, resetAt: cloud.resetAt };
  }
  const localUpdatedAt = local.updatedAt, cloudUpdatedAt = cloud.updatedAt;
  const newest = timestamp(localUpdatedAt) >= timestamp(cloudUpdatedAt) ? local : cloud;
  const questionProgress = {};
  for (const id of [...new Set([...Object.keys(cloud.questionProgress || {}), ...Object.keys(local.questionProgress || {})])].sort()) {
    const a = local.questionProgress?.[id], b = cloud.questionProgress?.[id];
    questionProgress[id] = a && b ? mergeQuestionProgress(a, b) : clone(a || b);
  }
  const sessions = new Map();
  [...(cloud.sessions || []), ...(local.sessions || [])].forEach(item => {
    if (item?.completedAt) {
      const key = sessionKey(item), previous = sessions.get(key);
      sessions.set(key, { ...clone(item), ...(previous?.activityRecorded ? { activityRecorded: true } : {}) });
    }
  });
  const startedAt = [local.startedAt, cloud.startedAt].filter(Boolean).sort((a, b) => timestamp(a) - timestamp(b))[0];
  const updatedAt = [localUpdatedAt, cloudUpdatedAt].filter(Boolean).sort((a, b) => timestamp(b) - timestamp(a))[0];
  return {
    ...cloud, ...local,
    startedAt: startedAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
    dailyGoal: laterValue(local.dailyGoal, cloud.dailyGoal, localUpdatedAt, cloudUpdatedAt) ?? 20,
    language: laterValue(local.language, cloud.language, localUpdatedAt, cloudUpdatedAt) || "en",
    uiLanguage: laterValue(local.uiLanguage, cloud.uiLanguage, localUpdatedAt, cloudUpdatedAt) || local.uiLanguage || cloud.uiLanguage || "en",
    streak: Math.max(local.streak || 1, cloud.streak || 1),
    questionProgress,
    sessions: [...sessions.values()].sort((a, b) => timestamp(a.completedAt) - timestamp(b.completedAt)).slice(-100),
    answerActivity: mergeAnswerActivity(local.answerActivity, cloud.answerActivity),
    ...Object.fromEntries(Object.entries(newest).filter(([key]) => !["startedAt", "updatedAt", "dailyGoal", "language", "uiLanguage", "streak", "questionProgress", "sessions", "answerActivity"].includes(key))),
  };
}

export function createSyncController({
  getProfile, applyProfile, onStateChange,
  config = SUPABASE_CONFIG, storage = localStorage, fetcher = fetch,
  browser = window, documentTarget = document,
  isOnline = () => navigator.onLine !== false,
}) {
  let key = storage.getItem(SYNC_KEY_STORAGE);
  if (!isValidSyncKey(key)) {
    key = generateSyncKey();
    storage.setItem(SYNC_KEY_STORAGE, key);
    storage.removeItem(LAST_SYNC_KEY);
  }
  let timer = null, syncing = false, pending = false, initialized = false, destroyed = false;
  let generation = 0, retryCount = 0;
  let state = {
    configured: Boolean(config.url && config.publishableKey), hasSyncKey: true,
    status: "local", lastSyncedAt: storage.getItem(LAST_SYNC_KEY), messageKey: "sync.localReady",
  };
  const emit = (patch = {}) => {
    state = { ...state, ...patch };
    if (!destroyed) onStateChange?.({ ...state });
  };
  const connectKey = (newKey) => {
    if (!isValidSyncKey(newKey)) throw new Error("Invalid private device link.");
    if (newKey !== key) {
      generation++;
      key = newKey;
      storage.setItem(SYNC_KEY_STORAGE, key);
      storage.removeItem(LAST_SYNC_KEY);
      retryCount = 0;
      pending = true;
      emit({ lastSyncedAt: null, error: null, messageKey: "sync.loadingCloud" });
    }
  };
  const consumeDeviceLink = () => {
    const params = new URLSearchParams(browser.location.hash.slice(1));
    if (!params.has("sync")) return;
    const imported = params.get("sync");
    // The capability is a fragment, never a query parameter. Remove it immediately.
    browser.history.replaceState(null, "", `${browser.location.pathname}${browser.location.search}#dashboard`);
    if (!isValidSyncKey(imported)) {
      emit({ status: "error", messageKey: "sync.invalidLink" });
      return;
    }
    connectKey(imported);
    if (initialized) void syncNow();
  };
  consumeDeviceLink();

  async function rpc(name, args) {
    const response = await fetcher(`${config.url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify(args), signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data?.message || `Cloud request failed (${response.status}).`);
      error.code = data?.code;
      error.status = response.status;
      throw error;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid cloud response.");
    return data;
  }

  async function syncNow() {
    clearTimeout(timer);
    timer = null;
    if (destroyed) return false;
    if (!state.configured) {
      emit({ status: "unconfigured", messageKey: "sync.notConfigured" });
      return false;
    }
    if (!isOnline()) {
      pending = true;
      emit({ status: "offline", messageKey: "sync.offlineAuto" });
      return false;
    }
    if (syncing) { pending = true; return false; }
    syncing = true;
    pending = false;
    const runGeneration = generation, runKey = key;
    let retryable = true;
    emit({ status: "syncing", messageKey: "sync.syncing", error: null });
    try {
      let cloud = await rpc("roadready_read_progress", { p_sync_key: runKey });
      for (let attempt = 0; attempt < 5; attempt++) {
        if (destroyed || runGeneration !== generation) return false;
        const cloudProfile = cloud.profile ? { ...cloud.profile, updatedAt: cloud.profile.updatedAt || cloud.updated_at } : {};
        // Re-read after every request: answers recorded during a fetch stay intact.
        const merged = mergeProfiles(getProfile(), cloudProfile);
        if (JSON.stringify(merged) !== JSON.stringify(getProfile())) applyProfile(merged);
        if (cloud.profile && JSON.stringify(merged) === JSON.stringify(cloud.profile)) break;
        const result = await rpc("roadready_write_progress", {
          p_sync_key: runKey, p_profile: merged, p_expected_revision: Number(cloud.revision || 0),
        });
        if (destroyed || runGeneration !== generation) return false;
        if (result.saved) break;
        if (attempt === 4) throw new Error("Another device is updating progress. Retrying shortly.");
        cloud = result;
      }
      const syncedAt = new Date().toISOString();
      storage.setItem(LAST_SYNC_KEY, syncedAt);
      retryCount = 0;
      emit({ status: pending ? "pending" : "synced", lastSyncedAt: syncedAt, messageKey: pending ? "sync.savedQueued" : "sync.upToDate", error: null });
    } catch (error) {
      if (destroyed || runGeneration !== generation) return false;
      const missingSetup = ["PGRST202", "42P01", "42883"].includes(error?.code);
      retryable = !missingSetup && ![400, 401, 403].includes(error?.status);
      pending = retryable;
      retryCount++;
      emit({ status: isOnline() ? "error" : "offline", messageKey: missingSetup ? "sync.setupDatabase" : isOnline() ? "sync.paused" : "sync.offlineWillSync", error: error?.message });
    } finally {
      syncing = false;
      if (!destroyed && pending && isOnline() && retryable) {
        const delay = retryCount ? Math.min(60000, 2000 * 2 ** Math.min(retryCount - 1, 5)) : SYNC_DELAY_MS;
        timer = setTimeout(syncNow, delay);
      }
    }
    return state.status === "synced";
  }

  const schedule = () => {
    if (destroyed || !state.configured) return;
    pending = true;
    emit({ status: isOnline() ? "pending" : "offline", messageKey: isOnline() ? "sync.savedQueued" : "sync.savedLater" });
    clearTimeout(timer);
    if (isOnline()) timer = setTimeout(syncNow, SYNC_DELAY_MS);
  };
  const online = () => { retryCount = 0; void syncNow(); };
  const offline = () => emit({ status: "offline", messageKey: "sync.offlineSaved" });
  const visible = () => { if (documentTarget.visibilityState === "visible" && isOnline()) void syncNow(); };
  browser.addEventListener("online", online);
  browser.addEventListener("offline", offline);
  browser.addEventListener("hashchange", consumeDeviceLink);
  documentTarget.addEventListener("visibilitychange", visible);

  return {
    initialize() { if (!initialized) { initialized = true; return syncNow(); } return Promise.resolve(state.status === "synced"); },
    schedule, syncNow,
    getState: () => ({ ...state }),
    getSyncKey: () => key,
    getDeviceLink: () => `${browser.location.origin}${browser.location.pathname}#sync=${key}`,
    connect: async (newKey) => { connectKey(newKey); return syncNow(); },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      browser.removeEventListener("online", online);
      browser.removeEventListener("offline", offline);
      browser.removeEventListener("hashchange", consumeDeviceLink);
      documentTarget.removeEventListener("visibilitychange", visible);
    },
  };
}
