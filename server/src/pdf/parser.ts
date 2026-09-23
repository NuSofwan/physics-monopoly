export interface Candidate { prompt: string; choices: string[]; answerIndex: number | null; explanation: string }
/** Conservative numbered-question parser; ambiguous layouts stay in the page review. */
export function parseCandidates(text: string): Candidate[] {
  const result: Candidate[] = [];
  let current: Candidate | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const question = line.match(/^(?:ข้อ\s*)?\d{1,3}[.)]\s*(.+)/);
    const choice = line.match(/^([A-Eกขคงจ])[.)]\s*(.+)/);
    const answer = line.match(/^(?:เฉลย|Answer)\s*[:：]\s*([A-Fกขคงจฉ])\s*(.*)/i);
    if (question) { current = { prompt: question[1]!, choices: [], answerIndex: null, explanation: "" }; result.push(current); }
    else if (current && choice) current.choices.push(choice[2]!);
    else if (current && answer) {
      const index = "ABCDEF".indexOf(answer[1]!.toUpperCase());
      current.answerIndex = index >= 0 ? index : "กขคงจฉ".indexOf(answer[1]!);
      current.explanation = answer[2]!;
    } else if (current && line && !current.choices.length) current.prompt += ` ${line}`;
  }
  return result.filter((item) => item.choices.length >= 2 && item.choices.length <= 5).slice(0, 100);
}
