// Word-level diff for comparing caption versions. Pure, no dependencies.

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

/** Above this many cells the LCS table is skipped and the middle is shown as replaced. */
const MAX_CELLS = 4_000_000;

/** Split into words and the whitespace between them, so joining the parts restores the text. */
function tokens(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function push(out: DiffPart[], kind: DiffPart["kind"], text: string) {
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push({ kind, text });
}

/**
 * Diff two texts word by word. Joining the "same" and "removed" parts gives
 * `before`; joining "same" and "added" gives `after`.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);

  // Trim the common prefix and suffix: most edits are small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const out: DiffPart[] = [];
  for (let i = 0; i < start; i++) push(out, "same", a[i]);

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;

  if (n * m > MAX_CELLS) {
    for (const t of midA) push(out, "removed", t);
    for (const t of midB) push(out, "added", t);
  } else {
    // lcs[i][j] = length of the longest common subsequence of midA[i:] and midB[j:]
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push(out, "same", midA[i]);
        i++;
        j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        push(out, "removed", midA[i++]);
      } else {
        push(out, "added", midB[j++]);
      }
    }
    while (i < n) push(out, "removed", midA[i++]);
    while (j < m) push(out, "added", midB[j++]);
  }

  for (let i = endA; i < a.length; i++) push(out, "same", a[i]);
  return out;
}

/** Word count as a writer would count it. */
export function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}
