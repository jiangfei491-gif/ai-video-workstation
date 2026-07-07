import type { ScriptCandidate, TournamentRound } from "./types";

function sortByScore(candidates: ScriptCandidate[]): ScriptCandidate[] {
  return [...candidates].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
}

const ROUND_LABELS: Record<number, string> = {
  1: "8 → 4",
  2: "4 → 2",
  3: "2 → 冠军",
};

export function runTournament(candidates: ScriptCandidate[]): {
  candidates: ScriptCandidate[];
  rounds: TournamentRound[];
  championId: string;
} {
  let active = sortByScore(candidates);
  const eliminatedAt = new Map<string, number>();
  const rounds: TournamentRound[] = [];
  let roundNum = 0;

  while (active.length > 1) {
    roundNum += 1;
    const keep = Math.max(1, Math.ceil(active.length / 2));
    const survivors = active.slice(0, keep);
    const eliminated = active.slice(keep);

    rounds.push({
      round: roundNum,
      label: ROUND_LABELS[roundNum] ?? `${active.length} → ${keep}`,
      survivorIds: survivors.map((c) => c.id),
      eliminatedIds: eliminated.map((c) => c.id),
    });

    for (const e of eliminated) eliminatedAt.set(e.id, roundNum);
    active = survivors;
  }

  const champion = active[0];
  if (!champion) throw new Error("淘汰赛无冠军");

  const all = candidates.map((c) => ({
    ...c,
    eliminated: eliminatedAt.has(c.id),
    eliminatedAtRound: eliminatedAt.get(c.id),
  }));

  return { candidates: all, rounds, championId: champion.id };
}
