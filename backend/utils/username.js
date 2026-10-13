
export const USERNAME_REGEX =
  /^(?=.{5,20}$)(?=.*\d)[a-zA-Z0-9](?:[a-zA-Z0-9._]*[a-zA-Z0-9])$/;


// Remove an optional leading @ and normalize to lowercase.
export const stripAt = (raw) => {
  if (typeof raw !== 'string') return '';

  return raw.trim().replace(/^@/, '').toLowerCase();
};


// Always use @username for storage and display.
export function normalizeUsername(raw) {
  const username = stripAt(raw);

  return username ? `@${username}` : '';
}


// Validate username format.
export function validateUsernameRules(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return {
      ok: false,
      error: 'Username is required.',
    };
  }

  const username = stripAt(raw);

  if (username.length < 5) {
    return {
      ok: false,
      error: 'Username must be at least 5 characters.',
    };
  }

  if (username.length > 20) {
    return {
      ok: false,
      error: 'Username can be at most 20 characters.',
    };
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return {
      ok: false,
      error: 'Use only letters, numbers, periods and underscores.',
    };
  }

  if (!/^[a-zA-Z0-9]/.test(username)) {
    return {
      ok: false,
      error: 'Username must start with a letter or number.',
    };
  }

  if (!/[a-zA-Z0-9]$/.test(username)) {
    return {
      ok: false,
      error: 'Username must end with a letter or number.',
    };
  }

  if (username.includes('..')) {
    return {
      ok: false,
      error: 'Consecutive periods are not allowed.',
    };
  }

  if (!/\d/.test(username)) {
    return {
      ok: false,
      error: 'Username is currently unavailable.',
    };
  }

  return { ok: true };
}


export const isValidUsernameFormat = (raw) =>
  validateUsernameRules(raw).ok;


// Shared username availability check.
// Used by seller onboarding and Edit Account.
export async function assertUsernameAvailable(rawUsername) {
  const { default: User } = await import('../models/User.js');

  const validation = validateUsernameRules(rawUsername);

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
    };
  }

  const username = normalizeUsername(rawUsername);

  // Usernames are stored in lowercase with a leading @.
  // This lookup assumes existing records follow that convention.
  const existing = await User.findOne({ username })
    .select('_id')
    .lean();

  if (existing) {
    return {
      ok: false,
      error: 'That username is already taken.',
    };
  }

  return {
    ok: true,
    username,
  };
}