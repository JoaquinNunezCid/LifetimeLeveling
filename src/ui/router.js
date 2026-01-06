export function createRouter() {
  let current = "dashboard";

  function setRoute(route) {
    current = route;
    document.querySelectorAll(".screen").forEach(s => {
      s.classList.toggle("active", s.dataset.screen === route);
    });

    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("active", t.dataset.route === route);
    });
    document.dispatchEvent(new CustomEvent("routechange", { detail: { route } }));
  }

  function getRoute() {
    return current;
  }

  return { setRoute, getRoute };
}
