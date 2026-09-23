// Browser QA only: clicks rendered controls, never imports game state or answer keys.
// Usage: pipe this file to agent-browser eval --stdin in an isolated test session.
if (window.physicsQa?.timer) clearInterval(window.physicsQa.timer);
window.physicsQa = { questions: 0, reveals: 0, actions: [], finished: false, seen: new Set() };
window.physicsQa.timer = setInterval(() => {
  const qa = window.physicsQa;
  const buttons = Array.from(document.querySelectorAll("button"));
  if (buttons.some((button) => button.textContent.trim() === "Play again")) {
    qa.finished = true;
    clearInterval(qa.timer);
    return;
  }
  const heading = Array.from(document.querySelectorAll("h2")).find((node) => node.textContent === "โจทย์ฟิสิกส์");
  if (heading) {
    const modal = heading.closest(".panel");
    const prompt = modal.querySelector("p.mt-4")?.textContent;
    const choice = Array.from(modal.querySelectorAll("button")).find((button) => !button.disabled);
    if (choice) { qa.questions++; qa.actions.push("answer"); choice.click(); }
    if (modal.textContent.includes("XP +") && !qa.seen.has(prompt)) { qa.reveals++; qa.seen.add(prompt); }
    if (qa.questions >= (window.physicsQaQuestionLimit ?? 2)) clearInterval(qa.timer);
    return;
  }
  const enabled = buttons.filter((button) => !button.disabled);
  const action = enabled.find((button) => button.textContent.trim() === "Solve jail quiz")
    ?? enabled.find((button) => /^(Roll dice|Buy with quiz)$/.test(button.textContent.trim()));
  if (action) { qa.actions.push(action.textContent.trim()); action.click(); }
}, 500);
"Browser QA started";
