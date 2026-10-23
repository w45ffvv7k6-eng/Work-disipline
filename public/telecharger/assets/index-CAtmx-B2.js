// Une vieille copie de l'appli (gardée par le navigateur) s'est ouverte à la place de la page « Télécharger ».
// Elle cherche son ancien fichier ici : on retire cette vieille copie, puis on recharge la vraie page.
// Les données de l'appli (séances, profil…) ne sont pas touchées.
(function () {
  var key = 'wd-old-copy-removed';
  try {
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
  } catch (e) {}
  var sw = navigator.serviceWorker;
  (sw ? sw.getRegistrations() : Promise.resolve([]))
    .then(function (list) {
      return Promise.all(
        list.map(function (r) {
          return r.unregister();
        }),
      );
    })
    .catch(function () {})
    .then(function () {
      location.reload();
    });
})();
