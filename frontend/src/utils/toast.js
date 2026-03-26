// tiny event-bus based toast system — no external dep
let counter = 0;

export const toast = {
  success: (msg) => emit("success", msg),
  error: (msg) => emit("error", msg),
  info: (msg) => emit("info", msg),
};

function emit(type, message) {
  const id = ++counter;
  const detail = { id, type, message };
  window.dispatchEvent(new CustomEvent("toast", { detail }));
  return id;
}
