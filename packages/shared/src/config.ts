/**
 * §6 Fail-closed configuration: only the exact strings `1` and `true` enable anything.
 * A typo, empty string, `false`, `yes`, `on` or unset all mean off.
 *
 * This is deliberately stricter than every "truthy env var" helper in circulation. `yes` and `on`
 * read as enabling to a human, which is exactly why they are refused: a flag that guesses at intent
 * is a flag that can be switched on by accident, and this one gates whether money can move.
 */

export function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/** The inverse is not `!isEnabled` in spirit: absent means off, and so does anything unrecognised. */
export function isDisabled(value: string | undefined): boolean {
  return !isEnabled(value);
}

export type RequiredSetting = { name: string; present: boolean };

/** Reports which of the named settings are absent, so a caller can refuse with CONFIG_INCOMPLETE. */
export function missingSettings(env: Record<string, string | undefined>, names: readonly string[]): string[] {
  return names.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim() === "";
  });
}
