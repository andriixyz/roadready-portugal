export function studyDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function recordStudyActivity(profile, deviceId, date = new Date()) {
  const day = studyDay(date);
  profile.answerActivity ||= {};
  const devices = profile.answerActivity[day] ||= {};
  devices[deviceId] = (devices[deviceId] || 0) + 1;
  profile.streak = studyStreak(profile, date);
}

export function studyStreak(profile, date = new Date()) {
  const cursor = new Date(date);
  cursor.setHours(12, 0, 0, 0);
  if (!answersOnDay(profile, cursor)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (answersOnDay(profile, cursor) > 0) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function answersOnDay(profile, date = new Date()) {
  const day = studyDay(date);
  const recorded = Object.values(profile.answerActivity?.[day] || {}).reduce((sum, count) => sum + count, 0);
  // Older profiles have only completed-session totals. Preserve those counts;
  // new sessions are marked because their answers were already counted live.
  const legacy = (profile.sessions || []).filter((session) => !session.activityRecorded
    && studyDay(new Date(session.completedAt)) === day).reduce((sum, session) => sum + session.total, 0);
  return recorded + legacy;
}

export function mergeAnswerActivity(local = {}, cloud = {}) {
  return Object.fromEntries([...new Set([...Object.keys(local), ...Object.keys(cloud)])].sort().map((day) => [day,
    Object.fromEntries([...new Set([...Object.keys(local[day] || {}), ...Object.keys(cloud[day] || {})])].sort()
      .map((device) => [device, Math.max(local[day]?.[device] || 0, cloud[day]?.[device] || 0)])),
  ]));
}
