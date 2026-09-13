// Sweeps hold advisory-lock clients while their helpers acquire other clients.
// Starting every sweep together can exhaust the pool with lock holders, leaving
// both their work and HTTP health checks waiting forever for a free connection.
const queues = new WeakMap()

export function enqueuePayrollTask(pool, name, task) {
  let queue = queues.get(pool)
  if (!queue) {
    queue = { tail: Promise.resolve(), pending: new Map() }
    queues.set(pool, queue)
  }
  // Initial and recurring timers can fire together. Keep at most one pending
  // execution per job, including while that job is running.
  if (queue.pending.has(name)) return queue.pending.get(name)
  const execution = queue.tail.then(task).catch(error => {
    console.error(`[payroll] ${name} failed:`, error)
  }).finally(() => {
    queue.pending.delete(name)
  })
  queue.pending.set(name, execution)
  queue.tail = execution
  return execution
}
