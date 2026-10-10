// Makes user input safe to put inside new RegExp(...). Escapes every character that is not a plain letter,
// digit or space with a backslash (harmless for characters that were not special anyway).
const BACKSLASH = String.fromCharCode(92)
export const escapeRegex = (s) => String(s).replace(/[^a-z0-9 ]/gi, (c) => BACKSLASH + c)
