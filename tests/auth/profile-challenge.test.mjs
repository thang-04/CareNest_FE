import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { normalizeAccountProfile } from '../../src/services/authProfile.js';
import {
  setPasswordChallenge,
  getPasswordChallenge,
  clearPasswordChallenge,
  setOtpRequest,
  getOtpRequest,
  clearOtpRequest,
} from '../../src/services/authChallengeStore.js';

beforeEach(() => {
  clearPasswordChallenge();
  clearOtpRequest();
});

test('profile normalizes account identity and prioritizes supported server roles', () => {
  const user = normalizeAccountProfile({
    userId: 17,
    username: 'staff-test',
    roles: ['TEACHER', 'PARENT', 'VICE_PRINCIPAL', 'PRINCIPAL', 'TEACHER', 'TEAM_LEADER'],
    assignments: [],
  });
  assert.equal(user.id, '17');
  assert.equal(user.role, 'PRINCIPAL');
  assert.deepEqual(user.roles, ['TEACHER', 'PARENT', 'VICE_PRINCIPAL', 'PRINCIPAL']);
  assert.equal(user.profileEditable, false);
});

test('each supported web role has deterministic priority independent of server ordering', () => {
  const priority = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];
  for (let index = 0; index < priority.length; index += 1) {
    assert.equal(
      normalizeAccountProfile({
        userId: 'test-id',
        roles: priority.slice(index).reverse(),
      }).role,
      priority[index],
    );
  }
});

test('unknown, parent, and admin roles never obtain a supported web role', () => {
  for (const roles of [['TEAM_LEADER'], ['PARENT'], ['ADMIN'], []]) {
    const user = normalizeAccountProfile({ userId: 1, roles });
    assert.equal(user.role, null);
    assert.equal(user.roles.includes('TEAM_LEADER'), false);
    assert.equal(user.campusId, null);
    assert.equal(user.classId, null);
    assert.deepEqual(user.locationIds, []);
    assert.deepEqual(user.classIds, []);
  }
});

test('assignments preserve server scopes and produce distinct keys without default scopes', () => {
  const assignments = [
    { staffRole: 'TEACHER', campusId: 2, classroomId: 7, validFrom: '2026-09-01' },
    { staffRole: 'TEACHER', campusId: 2, classroomId: 8, validFrom: '2026-09-01' },
    { staffRole: 'TEACHER', campusId: 2, classroomId: 7, validFrom: '2026-09-01' },
  ];
  const user = normalizeAccountProfile({ userId: 8, roles: ['TEACHER'], assignments });
  assert.equal(user.campusId, '2');
  assert.equal(user.classId, null);
  assert.deepEqual(user.locationIds, ['2']);
  assert.deepEqual(user.classIds, ['7', '8']);
  assert.equal(new Set(user.assignments.map((assignment) => assignment.key)).size, 3);
  assert.equal(assignments[0].key, undefined);
  const noScope = normalizeAccountProfile({ userId: 8, roles: ['PRINCIPAL'], assignments: [{ staffRole: 'PRINCIPAL' }] });
  assert.deepEqual(noScope.locationIds, []);
  assert.deepEqual(noScope.classIds, []);
});

test('missing identity or roles rejects the profile instead of inventing access', () => {
  for (const profile of [null, {}, { userId: 1 }, { roles: ['TEACHER'] }]) {
    assert.throws(() => normalizeAccountProfile(profile), { status: 503 });
  }
});

test('password challenge is copied defensively, stays in memory, and clears after use', () => {
  const original = { challengeId: 'challenge-test', username: 'test' };
  setPasswordChallenge(original);
  original.challengeId = 'mutated-input';
  const read = getPasswordChallenge();
  assert.equal(read.challengeId, 'challenge-test');
  read.challengeId = 'mutated-output';
  assert.equal(getPasswordChallenge().challengeId, 'challenge-test');
  clearPasswordChallenge();
  assert.equal(getPasswordChallenge(), null);
});

test('OTP proof is copied defensively and clears independently of password challenge', () => {
  setPasswordChallenge({ challengeId: 'password-test' });
  const original = { requestId: 'otp-test', resetToken: 'proof-test' };
  setOtpRequest(original);
  original.resetToken = 'mutated-input';
  const read = getOtpRequest();
  read.resetToken = 'mutated-output';
  assert.equal(getOtpRequest().resetToken, 'proof-test');
  clearOtpRequest();
  assert.equal(getOtpRequest(), null);
  assert.equal(getPasswordChallenge().challengeId, 'password-test');
});

test('challenge operations never access Web Storage or browser history', () => {
  const keys = ['localStorage', 'sessionStorage', 'window', 'history'];
  const previous = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => {
        throw new Error(`Forbidden browser proof sink: ${key}`);
      },
    });
  try {
    setPasswordChallenge({ challengeId: 'challenge-test' });
    setOtpRequest({ requestId: 'otp-test', resetToken: 'proof-test' });
    assert.equal(getPasswordChallenge().challengeId, 'challenge-test');
    assert.equal(getOtpRequest().resetToken, 'proof-test');
    clearPasswordChallenge();
    clearOtpRequest();
  } finally {
    keys.forEach((key, index) => {
      if (previous[index]) Object.defineProperty(globalThis, key, previous[index]);
      else delete globalThis[key];
    });
  }
});
