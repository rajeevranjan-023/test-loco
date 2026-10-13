const BACKSLASH = String.fromCharCode(92)
export const escapeRegex = (s) => String(s).replace(/[^a-z0-9 ]/gi, (c) => BACKSLASH + c)
