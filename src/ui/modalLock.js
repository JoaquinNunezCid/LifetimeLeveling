export function lockPageForModal() {
  const body = document.body;
  if (!body) return;
  const count = Number(body.dataset.modalLockCount || "0") + 1;
  body.dataset.modalLockCount = String(count);
  body.classList.add("modalOpen");
}

export function unlockPageForModal() {
  const body = document.body;
  if (!body) return;
  const count = Math.max(0, Number(body.dataset.modalLockCount || "0") - 1);
  if (count === 0) {
    delete body.dataset.modalLockCount;
    body.classList.remove("modalOpen");
    return;
  }
  body.dataset.modalLockCount = String(count);
}
