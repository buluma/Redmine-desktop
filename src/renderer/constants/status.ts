/**
 * Status name constants and helper functions.
 *
 * Redmine instances may use Chinese or English status names.
 * These helpers match both variants so business logic doesn't
 * need to know which locale the server uses.
 */

// ── Status name substrings ──────────────────────────────────────────────────
// We match on substrings (not exact) because Redmine statuses may have
// prefixes/suffixes like "In Progress" vs "开发中 (In Progress)".

const DEV_COMPLETE_PATTERNS = ['开发完成', 'Development Complete'] as const
const VERIFIED_PATTERNS = ['验证完成', 'Verification Complete'] as const
const CLOSED_PATTERNS = ['关闭', 'Closed'] as const
const DONE_PATTERNS = ['完成', 'Done'] as const

// ── Predicate helpers ───────────────────────────────────────────────────────

function matchesAny(name: string, patterns: readonly string[]): boolean {
  return patterns.some(p => name.includes(p))
}

/** Issue is in "dev complete / 开发完成" state (but not yet verified). */
export function isDevComplete(statusName: string): boolean {
  return matchesAny(statusName, DEV_COMPLETE_PATTERNS)
}

/** Issue is in "verified / 验证完成" state. */
export function isVerified(statusName: string): boolean {
  return matchesAny(statusName, VERIFIED_PATTERNS)
}

/** Issue is closed / 关闭. */
export function isClosed(statusName: string): boolean {
  return matchesAny(statusName, CLOSED_PATTERNS)
}

/** Issue is in any "done / 完成" state (dev-complete OR verified). */
export function isDone(statusName: string): boolean {
  return matchesAny(statusName, DONE_PATTERNS)
}

/** Issue is complete in any sense (done, verified, or closed). */
export function isComplete(statusName: string): boolean {
  return isDone(statusName) || isClosed(statusName)
}

// ── Visual helpers ──────────────────────────────────────────────────────────

export type IssueUrgency = 'active' | 'dev-complete' | 'verified'

/** Derive the visual urgency tier from a status name. */
export function getIssueUrgency(statusName: string): IssueUrgency {
  if (isVerified(statusName)) return 'verified'
  if (isDevComplete(statusName)) return 'dev-complete'
  return 'active'
}

/** CSS color for the issue circle indicator. */
export function getIssueStatusColor(statusName: string): string {
  switch (getIssueUrgency(statusName)) {
    case 'dev-complete':
      return '#30d158'     // green
    case 'verified':
      return 'var(--text-secondary)'
    case 'active':
    default:
      return '#ff453a'     // red
  }
}

/** Whether clicking the circle indicator should be disabled. */
export function isCircleActionDisabled(statusName: string): boolean {
  return isDevComplete(statusName) || isVerified(statusName)
}

/** Whether the issue subject should be styled as "done" (grey + strikethrough). */
export function isSubjectDone(statusName: string): boolean {
  return isVerified(statusName)
}

/** Default collapse state for a group header key. */
export function isGroupDefaultCollapsed(groupKey: string): boolean {
  return matchesAny(groupKey, VERIFIED_PATTERNS)
}

// ── Priority helpers ────────────────────────────────────────────────────────

const HIGH_PRIORITY_PATTERNS = ['urgent', 'high', 'immediate'] as const
const MEDIUM_PRIORITY_PATTERNS = ['medium', 'normal'] as const

export type BadgeUrgency = 'none' | 'low' | 'medium' | 'high'

/** Derive badge urgency from a priority name. */
export function getPriorityUrgency(priorityName: string): BadgeUrgency {
  const lower = priorityName.toLowerCase()
  if (HIGH_PRIORITY_PATTERNS.some(p => lower.includes(p))) return 'high'
  if (MEDIUM_PRIORITY_PATTERNS.some(p => lower.includes(p))) return 'medium'
  return 'low'
}
