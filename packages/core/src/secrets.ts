import { inspect } from "node:util";

/**
 * The spending key is the entire security of the derived account, so it must
 * never leave the process as plain JSON or a console log line. Both escape
 * hatches are neutralized here rather than trusted to caller discipline.
 */
export function createSecret(spendingKey: bigint) {
  return {
    spendingKey,
    toJSON(): never {
      throw new Error("refusing to serialize DerivedIdentitySecret");
    },
    [inspect.custom](): string {
      return "[redacted]";
    },
  };
}
