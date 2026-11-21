import type { CaseRecord } from "./types";

export function negotiationState(record: CaseRecord) {
  const review = record.aiReview;
  const parties = [record.userId, record.mediation?.respondentId].filter(
    (id): id is string => Boolean(id),
  );
  const proposals = review?.proposals.slice(0, 4) || [];
  const decisions = (record.proposalDecisions || []).filter(
    (item) => item.reviewId === review?.id,
  );
  for (let index = 0; index < proposals.length; index++) {
    const proposal = proposals[index];
    const replies = parties.map((userId) =>
      decisions.find(
        (item) => item.userId === userId && item.proposalId === proposal.id,
      ),
    );
    const complete = parties.length === 2 && replies.every(Boolean);
    const agreed =
      complete && replies.every((reply) => reply?.decision === "ACCEPT");
    if (agreed || !complete)
      return {
        index,
        round: index + 1,
        proposal,
        agreed,
        exhausted: false,
        complete,
      };
  }
  return {
    index: proposals.length,
    round: proposals.length,
    proposal: undefined,
    agreed: false,
    exhausted: proposals.length === 4,
    complete: proposals.length === 4,
  };
}
