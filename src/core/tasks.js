export function addTask(tasks, text) {
  const trimmed = text.trim();
  if (!trimmed) return tasks;

  const id = (crypto?.randomUUID?.() ?? String(Date.now()));
  const t = {
    id,
    text: trimmed,
    done: false,
    createdAt: new Date().toISOString(),
  };

  return [t, ...tasks];
}

export function markTaskDone(tasks, id) {
  return tasks.map(t =>
    t.id === id
      ? { ...t, done: true, doneAt: new Date().toISOString() }
      : t
  );
}

export function pendingTasks(tasks) {
  return tasks.filter(t => !t.done);
}
