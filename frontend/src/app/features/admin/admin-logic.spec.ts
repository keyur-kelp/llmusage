import { buildUserPatch, filterUsers } from './users-tab.component';
import { filterSummaryUsers, pageSlice, sortSummaryUsers } from './usage-tab.component';
import { MONEY_PATTERN } from './settings-tab.component';
import { describeError } from '../../core/api/admin-api';
import { ApiError } from '../../core/api/api-error';
import { SummaryUser, UserDto } from '../../core/api/models';

const u: UserDto = { id: '1', email: 'a@b.c', name: 'Ann', role: 'USER', isActive: true, quotaOverrideUsd: '2.500000' };
const result = { name: 'Ann', email: 'a@b.c', password: '', role: 'USER' as const, quotaOverrideUsd: '2.5' };

describe('buildUserPatch', () => {
  it('sends nothing when nothing changed (2.5 equals 2.500000)', () => {
    expect(buildUserPatch(u, result, false)).toEqual({});
  });
  it('clears the override with null when the field is emptied', () => {
    expect(buildUserPatch(u, { ...result, quotaOverrideUsd: '' }, false)).toEqual({ quotaOverrideUsd: null });
  });
  it('sets a new override and role/name changes', () => {
    expect(buildUserPatch({ ...u, quotaOverrideUsd: null }, { ...result, name: 'B', role: 'ADMIN', quotaOverrideUsd: '1' }, false)).toEqual({
      name: 'B',
      role: 'ADMIN',
      quotaOverrideUsd: '1',
    });
  });
  it('never sends a role change for the signed-in admin', () => {
    expect(buildUserPatch(u, { ...result, role: 'ADMIN' }, true)).toEqual({});
  });
});

describe('settings money pattern', () => {
  it('rejects negatives, exponents and >6 decimals', () => {
    for (const bad of ['-1', '1e3', '1.1234567', '', '.5']) expect(MONEY_PATTERN.test(bad)).toBeFalse();
    for (const good of ['0', '100', '0.000001']) expect(MONEY_PATTERN.test(good)).toBeTrue();
  });
});

describe('sortSummaryUsers', () => {
  const mk = (name: string, used: string): SummaryUser => ({
    userId: name, name, email: name, role: 'USER', isActive: true,
    usedUsd: used, quotaUsd: '10.000000', remainingUsd: '0', usedPct: '0', isOverride: false,
  });
  const rows = [mk('a', '9.999999'), mk('b', '10.000000'), mk('c', '0.000001')];
  it('sorts by used descending using decimal comparison', () => {
    expect(sortSummaryUsers(rows, { active: 'usedUsd', direction: 'desc' }).map((r) => r.name)).toEqual(['b', 'a', 'c']);
  });
  it('sorts ascending and by name', () => {
    expect(sortSummaryUsers(rows, { active: 'usedUsd', direction: 'asc' }).map((r) => r.name)).toEqual(['c', 'a', 'b']);
    expect(sortSummaryUsers(rows, { active: 'name', direction: 'desc' }).map((r) => r.name)).toEqual(['c', 'b', 'a']);
  });
});

describe('describeError', () => {
  it('joins validation issues', () => {
    const e = new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      issues: [{ path: 'systemQuotaUsd', message: 'bad' }],
    });
    expect(describeError(e)).toBe('systemQuotaUsd: bad');
  });
  it('falls back to the message', () => {
    expect(describeError(new ApiError(409, 'EMAIL_TAKEN', 'taken'))).toBe('taken');
  });
});

describe('filterUsers', () => {
  const users: UserDto[] = [u, { ...u, id: '2', name: 'Bob', email: 'bob@x.y' }];
  it('matches name or email case-insensitively', () => {
    expect(filterUsers(users, 'BOB').map((x) => x.id)).toEqual(['2']);
    expect(filterUsers(users, 'a@b').map((x) => x.id)).toEqual(['1']);
    expect(filterUsers(users, '  ').length).toBe(2);
  });
});

describe('usage paging', () => {
  const mk = (i: number): SummaryUser => ({
    userId: String(i), name: 'User ' + i, email: `u${i}@x.y`, role: 'USER', isActive: true,
    usedUsd: i.toFixed(6), quotaUsd: '10.000000', remainingUsd: '0', usedPct: '0', isOverride: false,
  });
  const rows = Array.from({ length: 60 }, (_, i) => mk(i));
  it('sorts the whole list before taking a page', () => {
    const sorted = sortSummaryUsers(rows, { active: 'usedUsd', direction: 'desc' });
    expect(pageSlice(sorted, 0, 25).map((r) => r.name)[0]).toBe('User 59');
    expect(pageSlice(sorted, 2, 25).length).toBe(10);
  });
  it('clamps a page index past the end', () => {
    expect(pageSlice(rows, 9, 25).length).toBe(10);
    expect(pageSlice([], 3, 25)).toEqual([]);
  });
  it('filters by name or email', () => {
    expect(filterSummaryUsers(rows, 'u5@').map((r) => r.name)).toEqual(['User 5']);
    expect(filterSummaryUsers(rows, '').length).toBe(60);
  });
});
