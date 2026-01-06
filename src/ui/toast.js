export function createToast() {
  const el = document.getElementById("toast");
  let timer = null;

  function show(message, ms = 2000) {
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove("show"), ms);
  }

  return { show };
}
