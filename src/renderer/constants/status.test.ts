import { describe, it, expect } from 'vitest'
import {
  isDevComplete,
  isVerified,
  isClosed,
  isDone,
  isComplete,
  getIssueUrgency,
  getIssueStatusColor,
  isCircleActionDisabled,
  isSubjectDone,
  isGroupDefaultCollapsed,
  getPriorityUrgency,
} from './status'

describe('isDevComplete', () => {
  it('matches Chinese status', () => {
    expect(isDevComplete('开发完成')).toBe(true)
  })
  it('matches English status', () => {
    expect(isDevComplete('Development Complete')).toBe(true)
  })
  it('matches partial strings', () => {
    expect(isDevComplete('In 开发完成')).toBe(true)
    expect(isDevComplete('Development Complete (reviewed)')).toBe(true)
  })
  it('rejects unrelated statuses', () => {
    expect(isDevComplete('New')).toBe(false)
    expect(isDevComplete('验证完成')).toBe(false)
    expect(isDevComplete('In Progress')).toBe(false)
  })
})

describe('isVerified', () => {
  it('matches Chinese status', () => {
    expect(isVerified('验证完成')).toBe(true)
  })
  it('matches English status', () => {
    expect(isVerified('Verification Complete')).toBe(true)
  })
  it('rejects unrelated statuses', () => {
    expect(isVerified('开发完成')).toBe(false)
    expect(isVerified('New')).toBe(false)
  })
})

describe('isClosed', () => {
  it('matches Chinese status', () => {
    expect(isClosed('关闭')).toBe(true)
  })
  it('matches English status', () => {
    expect(isClosed('Closed')).toBe(true)
  })
  it('rejects unrelated statuses', () => {
    expect(isClosed('New')).toBe(false)
  })
})

describe('isDone', () => {
  it('matches any "complete" status', () => {
    expect(isDone('开发完成')).toBe(true)
    expect(isDone('验证完成')).toBe(true)
    expect(isDone('Done')).toBe(true)
  })
  it('rejects incomplete statuses', () => {
    expect(isDone('New')).toBe(false)
    expect(isDone('In Progress')).toBe(false)
  })
})

describe('isComplete', () => {
  it('matches done, verified, and closed', () => {
    expect(isComplete('开发完成')).toBe(true)
    expect(isComplete('验证完成')).toBe(true)
    expect(isComplete('关闭')).toBe(true)
    expect(isComplete('Closed')).toBe(true)
  })
  it('rejects active statuses', () => {
    expect(isComplete('New')).toBe(false)
    expect(isComplete('In Progress')).toBe(false)
  })
})

describe('getIssueUrgency', () => {
  it('returns correct tiers', () => {
    expect(getIssueUrgency('New')).toBe('active')
    expect(getIssueUrgency('In Progress')).toBe('active')
    expect(getIssueUrgency('开发完成')).toBe('dev-complete')
    expect(getIssueUrgency('Development Complete')).toBe('dev-complete')
    expect(getIssueUrgency('验证完成')).toBe('verified')
    expect(getIssueUrgency('Verification Complete')).toBe('verified')
  })
})

describe('getIssueStatusColor', () => {
  it('returns red for active', () => {
    expect(getIssueStatusColor('New')).toBe('#ff453a')
  })
  it('returns green for dev-complete', () => {
    expect(getIssueStatusColor('开发完成')).toBe('#30d158')
  })
  it('returns secondary for verified', () => {
    expect(getIssueStatusColor('验证完成')).toBe('var(--text-secondary)')
  })
})

describe('isCircleActionDisabled', () => {
  it('disabled for dev-complete and verified', () => {
    expect(isCircleActionDisabled('开发完成')).toBe(true)
    expect(isCircleActionDisabled('验证完成')).toBe(true)
  })
  it('enabled for active', () => {
    expect(isCircleActionDisabled('New')).toBe(false)
    expect(isCircleActionDisabled('In Progress')).toBe(false)
  })
})

describe('isSubjectDone', () => {
  it('true only for verified', () => {
    expect(isSubjectDone('验证完成')).toBe(true)
    expect(isSubjectDone('Verification Complete')).toBe(true)
  })
  it('false for dev-complete', () => {
    expect(isSubjectDone('开发完成')).toBe(false)
  })
  it('false for active', () => {
    expect(isSubjectDone('New')).toBe(false)
  })
})

describe('isGroupDefaultCollapsed', () => {
  it('collapses verified groups', () => {
    expect(isGroupDefaultCollapsed('验证完成')).toBe(true)
    expect(isGroupDefaultCollapsed('Verification Complete')).toBe(true)
  })
  it('does not collapse other groups', () => {
    expect(isGroupDefaultCollapsed('New')).toBe(false)
    expect(isGroupDefaultCollapsed('In Progress')).toBe(false)
    expect(isGroupDefaultCollapsed('开发完成')).toBe(false)
  })
})

describe('getPriorityUrgency', () => {
  it('detects high priority', () => {
    expect(getPriorityUrgency('Urgent')).toBe('high')
    expect(getPriorityUrgency('High')).toBe('high')
    expect(getPriorityUrgency('Immediate')).toBe('high')
  })
  it('detects medium priority', () => {
    expect(getPriorityUrgency('Normal')).toBe('medium')
    expect(getPriorityUrgency('Medium')).toBe('medium')
  })
  it('defaults to low', () => {
    expect(getPriorityUrgency('Low')).toBe('low')
    expect(getPriorityUrgency('Unknown')).toBe('low')
  })
  it('is case-insensitive', () => {
    expect(getPriorityUrgency('urgent')).toBe('high')
    expect(getPriorityUrgency('NORMAL')).toBe('medium')
  })
})
