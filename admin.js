/* =========================================================================
   ANICK COIFFURE — admin.js (tableau de bord commerçant, vanilla JS)
   -------------------------------------------------------------------------
   - Lit / crée / annule des RDV via /api/rdv-list, /api/rdv-create,
     /api/rdv-delete. Tout en AJAX : la page ne se recharge jamais.
   - Authentification optionnelle : si une fonction renvoie 401, on affiche
     l'écran « code d'accès » et on rejoue la requête avec le header
     x-dashboard-password (code gardé en mémoire de session).
   - Aucune dépendance, aucune build. Réutilise style.css.
   ========================================================================= */
(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     TABLE DES PRESTATIONS — miroir de lib/config.js
     -----------------------------------------------------------------------
     Sert à remplir le <select> et à colorer/afficher la liste. La DURÉE
     n'est qu'indicative ici : le serveur (rdv-create) recalcule toujours la
     durée réelle depuis lib/config.js d'après la clé. Gardez ce miroir
     synchronisé avec lib/config.js si vous modifiez les prestations.
     famille : pour la couleur du trait vertical (soins/coupe/tresses/couleur).
     --------------------------------------------------------------------- */
  var PRESTATIONS = {
    diagnostic:       { libelle: "Diagnostic & conseil personnalisé",    duree: 20,   famille: "soins" },
    soin_hydratation: { libelle: "Soin hydratation profonde",            duree: 45,   famille: "soins" },
    soin_proteine:    { libelle: "Soin protéiné / reconstruction",       duree: 60,   famille: "soins" },
    rituel_cuir:      { libelle: "Rituel cuir chevelu & massage",        duree: 45,   famille: "soins" },
    coupe_femme:      { libelle: "Coupe femme + coiffage",               duree: 60,   famille: "coupe" },
    coupe_boucles:    { libelle: "Coupe bouclés / afro (méthode à sec)", duree: 90,   famille: "coupe" },
    brushing:         { libelle: "Brushing",                             duree: 60,   famille: "coupe" },
    wash_go:          { libelle: "Wash & Go / définition des boucles",   duree: 60,   famille: "coupe" },
    evenementiel:     { libelle: "Coiffure événementielle (mariage…)",   duree: null, famille: "coupe", devis: true },
    box_braids:       { libelle: "Box braids / tresses collées",         duree: 240,  famille: "tresses" },
    vanilles:         { libelle: "Vanilles & twists",                    duree: 180,  famille: "tresses" },
    tissage:          { libelle: "Tissage / pose d'extensions",          duree: 150,  famille: "tresses" },
    nattes_enfant:    { libelle: "Nattes & coiffures enfant",            duree: 45,   famille: "tresses" },
    color_racines:    { libelle: "Coloration racines",                   duree: 75,   famille: "couleur" },
    color_complete:   { libelle: "Coloration complète",                  duree: 120,  famille: "couleur" },
    balayage:         { libelle: "Balayage / mèches",                    duree: 150,  famille: "couleur" },
    patine:           { libelle: "Patine / gloss",                       duree: 45,   famille: "couleur" },
  };

  /* Catégories (ordre + libellé des <optgroup>) -> clés de prestations. */
  var CATEGORIES = [
    { titre: "Soins & Traitements", cles: ["diagnostic", "soin_hydratation", "soin_proteine", "rituel_cuir"] },
    { titre: "Coupe & Coiffage",    cles: ["coupe_femme", "coupe_boucles", "brushing", "wash_go", "evenementiel"] },
    { titre: "Tresses & Extensions", cles: ["box_braids", "vanilles", "tissage", "nattes_enfant"] },
    { titre: "Couleur & Mèches",    cles: ["color_racines", "color_complete", "balayage", "patine"] },
  ];

  /* -----------------------------------------------------------------------
     OUTILS DE FORMAT
     --------------------------------------------------------------------- */
  /* Durée lisible : 20 -> "20 min", 60 -> "1 h", 150 -> "2 h 30". */
  function formatDuree(min) {
    if (min == null) return "durée variable";
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60), m = min % 60;
    return m === 0 ? h + " h" : h + " h " + (m < 10 ? "0" + m : m);
  }

  /* "YYYY-MM-DD" -> Date locale (midi, pour éviter les décalages de fuseau). */
  function dateDepuisISO(iso) {
    return new Date(iso + "T12:00:00");
  }

  /* "Lundi 15 juin" (capitalisé). */
  function titreJour(iso) {
    var s = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    }).format(dateDepuisISO(iso));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* Date du jour (fuseau du salon) au format "YYYY-MM-DD". */
  function aujourdhuiISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }

  /* Initiales d'une cliente (ex. « Marie Koffi » -> « MK »). */
  function initiales(prenom, nom) {
    var a = (prenom || "").trim().charAt(0);
    var b = (nom || "").trim().charAt(0);
    return (a + b).toUpperCase() || "?";
  }

  /* Échappe le texte injecté en HTML (les coordonnées viennent de l'agenda). */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* -----------------------------------------------------------------------
     ÉTAT + RÉFÉRENCES DOM
     --------------------------------------------------------------------- */
  var PWD_KEY = "anick_dashboard_pwd";
  var motDePasse = sessionStorage.getItem(PWD_KEY) || "";
  var rdvParId = {};      // index id -> objet RDV (pour la fiche détail)
  var tousLesRdv = [];    // dernière liste chargée
  var periode = "jour";   // "jour" | "semaine"

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };

  var gate = $("[data-gate]");
  var gateForm = $("[data-gate-form]");
  var gateError = $("[data-gate-error]");
  var app = $("[data-app]");

  var vues = {
    liste: $('[data-view="liste"]'),
    detail: $('[data-view="detail"]'),
    ajout: $('[data-view="ajout"]'),
  };

  /* -----------------------------------------------------------------------
     APPELS API (avec gestion du code d'accès)
     --------------------------------------------------------------------- */
  function apiFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    // Toujours forcer le réseau : sinon le navigateur peut resservir un vieux
    // 401 mis en cache (ex. après suppression du mot de passe) et réafficher
    // l'écran de code à tort.
    options.cache = "no-store";
    if (motDePasse) options.headers["x-dashboard-password"] = motDePasse;
    return fetch(url, options).then(function (res) {
      if (res.status === 401) {
        // Code requis ou incorrect : on affiche l'écran de saisie.
        afficherGate(motDePasse ? "Code incorrect, réessayez." : null);
        var err = new Error("auth");
        err.auth = true;
        throw err;
      }
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function afficherGate(message) {
    if (message && gateError) {
      gateError.textContent = message;
      gateError.hidden = false;
    }
    app.hidden = true;
    gate.hidden = false;
    var input = $("#gate-pwd");
    if (input) input.focus();
  }

  function masquerGate() {
    gate.hidden = true;
    app.hidden = false;
  }

  if (gateForm) {
    gateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("#gate-pwd");
      motDePasse = input ? input.value.trim() : "";
      sessionStorage.setItem(PWD_KEY, motDePasse);
      if (gateError) gateError.hidden = true;
      masquerGate();
      chargerListe();
    });
  }

  /* -----------------------------------------------------------------------
     NAVIGATION ENTRE VUES
     --------------------------------------------------------------------- */
  function montrerVue(nom) {
    Object.keys(vues).forEach(function (k) {
      if (vues[k]) vues[k].hidden = (k !== nom);
    });
    window.scrollTo(0, 0);
  }

  /* -----------------------------------------------------------------------
     CHARGEMENT + RENDU DE LA LISTE
     --------------------------------------------------------------------- */
  var listeEl = $("[data-list]");
  var flashEl = $("[data-flash]");

  function flash(type, message) {
    if (!flashEl) return;
    flashEl.className = "admin-flash is-" + type;
    flashEl.textContent = message;
    flashEl.hidden = false;
    if (type === "ok") {
      window.setTimeout(function () { flashEl.hidden = true; }, 5000);
    }
  }

  function chargerListe() {
    listeEl.innerHTML =
      '<p class="admin-empty"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</p>';
    apiFetch("/api/rdv-list?jours=30")
      .then(function (r) {
        if (!r.ok) {
          listeEl.innerHTML =
            '<p class="admin-empty is-error">Impossible de charger les rendez-vous.</p>';
          return;
        }
        tousLesRdv = r.data.rdv || [];
        rdvParId = {};
        tousLesRdv.forEach(function (rdv) { rdvParId[rdv.id] = rdv; });
        majResume();
        rendreListe();
      })
      .catch(function (err) {
        if (err && err.auth) return; // l'écran code a déjà pris le relais
        listeEl.innerHTML =
          '<p class="admin-empty is-error">Connexion impossible. Réessayez.</p>';
      });
  }

  /* Filtre les RDV selon la période (jour = aujourd'hui ; semaine = +7 jours). */
  function rdvVisibles() {
    var debut = aujourdhuiISO();
    if (periode === "jour") {
      return tousLesRdv.filter(function (r) { return r.dateISO === debut; });
    }
    // Semaine : d'aujourd'hui à +6 jours inclus.
    var fin = new Date(dateDepuisISO(debut).getTime() + 6 * 86400000);
    var finISO = new Intl.DateTimeFormat("en-CA").format(fin);
    return tousLesRdv.filter(function (r) {
      return r.dateISO >= debut && r.dateISO <= finISO;
    });
  }

  function rendreListe() {
    var liste = rdvVisibles();

    if (!liste.length) {
      listeEl.innerHTML =
        '<p class="admin-empty"><i class="fa-regular fa-calendar"></i> ' +
        (periode === "jour"
          ? "Aucun rendez-vous aujourd'hui."
          : "Aucun rendez-vous cette semaine.") +
        "</p>";
      return;
    }

    // Le tout premier RDV de la liste complète (à venir) est mis en avant.
    var prochainId = tousLesRdv.length ? tousLesRdv[0].id : null;

    // Regroupement par jour (la liste est déjà triée par date/heure).
    var html = "";
    var jourCourant = null;
    liste.forEach(function (rdv) {
      if (rdv.dateISO !== jourCourant) {
        jourCourant = rdv.dateISO;
        html += '<h2 class="day-title">' + esc(titreJour(rdv.dateISO)) + "</h2>";
      }
      html += carteRdv(rdv, rdv.id === prochainId);
    });
    listeEl.innerHTML = html;

    // Clic sur une carte -> fiche détail.
    listeEl.querySelectorAll("[data-rdv]").forEach(function (el) {
      el.addEventListener("click", function () {
        ouvrirDetail(el.getAttribute("data-rdv"));
      });
    });
  }

  function carteRdv(rdv, estProchain) {
    var pres = PRESTATIONS[rdv.prestationCle] || {};
    var famille = pres.famille || "coupe";
    var nomClient = (rdv.prenom + " " + rdv.nom).trim() || "Cliente";
    var pastille = rdv.source === "commercant"
      ? '<span class="rdv-tag"><i class="fa-solid fa-phone"></i> par téléphone</span>'
      : "";

    return (
      '<button class="rdv-card' + (estProchain ? " is-next" : "") + '"' +
        ' data-rdv="' + esc(rdv.id) + '" data-famille="' + famille + '">' +
        '<span class="rdv-card__time">' +
          '<strong>' + esc(rdv.heureDebut) + "</strong>" +
          '<small>' + esc(formatDuree(rdv.dureeMin)) + "</small>" +
        "</span>" +
        '<span class="rdv-card__bar" aria-hidden="true"></span>' +
        '<span class="rdv-card__main">' +
          '<span class="rdv-card__presta">' + esc(rdv.prestationLibelle) + "</span>" +
          '<span class="rdv-card__client">' + esc(nomClient) + pastille + "</span>" +
        "</span>" +
        '<i class="fa-solid fa-chevron-right rdv-card__chevron" aria-hidden="true"></i>' +
      "</button>"
    );
  }

  /* -----------------------------------------------------------------------
     CARTES RÉSUMÉ + LIBELLÉ DE SEMAINE
     --------------------------------------------------------------------- */
  function majResume() {
    var ajd = aujourdhuiISO();
    var duJour = tousLesRdv.filter(function (r) { return r.dateISO === ajd; });
    var minutes = duJour.reduce(function (acc, r) { return acc + (r.dureeMin || 0); }, 0);

    $("[data-sum-count]").textContent = duJour.length;
    $("[data-sum-time]").textContent = minutes ? formatDuree(minutes) : "0 h";

    var prochain = tousLesRdv.length ? tousLesRdv[0] : null;
    $("[data-sum-next]").textContent = prochain ? prochain.heureDebut : "—";
    $("[data-sum-next-day]").textContent = prochain
      ? (prochain.dateISO === ajd ? "aujourd'hui" : titreJour(prochain.dateISO))
      : " ";

    // Libellé de la semaine courante dans l'en-tête.
    var label = $("[data-week-label]");
    if (label) {
      var lundi = lundiDeLaSemaine(dateDepuisISO(ajd));
      var dimanche = new Date(lundi.getTime() + 6 * 86400000);
      var fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
      label.textContent = "Semaine du " + fmt.format(lundi) + " au " + fmt.format(dimanche);
    }
  }

  function lundiDeLaSemaine(d) {
    var j = d.getDay(); // 0 = dimanche
    var diff = (j === 0 ? -6 : 1 - j);
    return new Date(d.getTime() + diff * 86400000);
  }

  /* -----------------------------------------------------------------------
     FICHE DÉTAIL
     --------------------------------------------------------------------- */
  var detailEl = $("[data-detail]");

  function ouvrirDetail(id) {
    var rdv = rdvParId[id];
    if (!rdv) return;

    var pres = PRESTATIONS[rdv.prestationCle] || {};
    var famille = pres.famille || "coupe";
    var nomClient = (rdv.prenom + " " + rdv.nom).trim() || "Cliente";

    function ligne(icone, valeur, lien) {
      if (!valeur) return "";
      var contenu = lien
        ? '<a href="' + lien + esc(valeur) + '">' + esc(valeur) + "</a>"
        : esc(valeur);
      return (
        '<li><i class="fa-solid ' + icone + '" aria-hidden="true"></i>' +
        "<span>" + contenu + "</span></li>"
      );
    }

    detailEl.setAttribute("data-famille", famille);
    detailEl.innerHTML =
      '<span class="detail-badge"><i class="fa-solid fa-circle-check"></i> Confirmé</span>' +
      '<div class="detail-client">' +
        '<span class="detail-avatar">' + esc(initiales(rdv.prenom, rdv.nom)) + "</span>" +
        "<div>" +
          "<h2>" + esc(nomClient) + "</h2>" +
          '<p>' + esc(rdv.prestationLibelle) + " · " + esc(formatDuree(rdv.dureeMin)) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="detail-when">' +
        '<i class="fa-regular fa-calendar"></i>' +
        "<div>" +
          "<strong>" + esc(titreJour(rdv.dateISO)) + "</strong>" +
          "<span>" + esc(rdv.heureDebut) + " → " + esc(rdv.heureFin) + "</span>" +
        "</div>" +
      "</div>" +
      (rdv.source === "commercant"
        ? '<p class="detail-source"><i class="fa-solid fa-phone"></i> Ajouté au téléphone</p>'
        : "") +
      '<ul class="detail-coords">' +
        ligne("fa-envelope", rdv.email, "mailto:") +
        ligne("fa-phone", rdv.telephone, "tel:") +
        ligne("fa-location-dot", rdv.adresse, null) +
        ligne("fa-note-sticky", rdv.note, null) +
      "</ul>" +
      '<button class="btn btn--danger detail-cancel" data-cancel="' + esc(rdv.id) + '">' +
        '<i class="fa-solid fa-trash-can"></i> Annuler le RDV' +
      "</button>";

    var btn = $("[data-cancel]", detailEl);
    if (btn) {
      btn.addEventListener("click", function () { annulerRdv(rdv.id, btn); });
    }
    montrerVue("detail");
  }

  function annulerRdv(id, btn) {
    if (!window.confirm("Confirmer l'annulation de ce rendez-vous ?")) return;
    var html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Annulation…';

    apiFetch("/api/rdv-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
    })
      .then(function (r) {
        if (r.ok && r.data.ok) {
          montrerVue("liste");
          flash("ok", "Rendez-vous annulé.");
          chargerListe();
        } else {
          btn.disabled = false;
          btn.innerHTML = html;
          window.alert((r.data && r.data.erreur) || "Annulation impossible.");
        }
      })
      .catch(function (err) {
        if (err && err.auth) return;
        btn.disabled = false;
        btn.innerHTML = html;
        window.alert("Connexion impossible. Réessayez.");
      });
  }

  /* -----------------------------------------------------------------------
     FORMULAIRE D'AJOUT MANUEL
     --------------------------------------------------------------------- */
  var addForm = $("[data-add-form]");
  var addFlash = $("[data-add-flash]");
  var selPresta = $("#a-prestation");
  var dureeWrap = $("[data-duree-wrap]");
  var dureeInput = $("#a-duree");

  /* Remplit le <select> prestation depuis la table (optgroups + durée). */
  function remplirSelectPrestation() {
    if (!selPresta) return;
    CATEGORIES.forEach(function (cat) {
      var og = document.createElement("optgroup");
      og.label = cat.titre;
      cat.cles.forEach(function (cle) {
        var p = PRESTATIONS[cle];
        if (!p) return;
        var opt = document.createElement("option");
        opt.value = cle;
        opt.textContent = p.libelle +
          (p.duree != null ? " — " + formatDuree(p.duree) : " — durée variable");
        og.appendChild(opt);
      });
      selPresta.appendChild(og);
    });
  }

  if (selPresta) {
    selPresta.addEventListener("change", function () {
      // Prestation « sur devis » -> on demande une durée explicite.
      var p = PRESTATIONS[selPresta.value];
      var devis = p && p.duree == null;
      dureeWrap.hidden = !devis;
      if (dureeInput) dureeInput.required = devis;
    });
  }

  function addFlashMsg(type, message) {
    if (!addFlash) return;
    addFlash.className = "admin-flash is-" + type;
    addFlash.textContent = message;
    addFlash.hidden = false;
  }

  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      e.preventDefault();
      addFlash.hidden = true;

      // Validation native (champs requis, formats).
      if (!addForm.checkValidity()) {
        addForm.reportValidity();
        return;
      }

      var data = {
        prenom: $("#a-prenom").value.trim(),
        nom: $("#a-nom").value.trim(),
        telephone: $("#a-tel").value.trim(),
        email: $("#a-email").value.trim(),
        adresse: $("#a-adresse").value.trim(),
        prestation: selPresta.value,
        dateISO: $("#a-date").value,
        heure: $("#a-heure").value,
      };
      var p = PRESTATIONS[data.prestation];
      if (p && p.duree == null) {
        data.dureeMin = parseInt(dureeInput.value, 10);
      }

      var btn = addForm.querySelector('button[type="submit"]');
      var btnHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement…';

      apiFetch("/api/rdv-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(function (r) {
          btn.disabled = false;
          btn.innerHTML = btnHtml;
          if (r.ok && r.data.ok) {
            addForm.reset();
            if (dureeWrap) dureeWrap.hidden = true;
            montrerVue("liste");
            flash("ok", "Rendez-vous enregistré.");
            chargerListe();
          } else {
            addFlashMsg("error", (r.data && r.data.erreur) || "Enregistrement impossible.");
          }
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.innerHTML = btnHtml;
          if (err && err.auth) return;
          addFlashMsg("error", "Connexion impossible. Réessayez.");
        });
    });
  }

  /* -----------------------------------------------------------------------
     BOUTONS DE NAVIGATION (ajout / retours / période)
     --------------------------------------------------------------------- */
  var btnOpenAdd = $("[data-open-add]");
  if (btnOpenAdd) {
    btnOpenAdd.addEventListener("click", function () {
      // Pré-remplit la date du jour pour aller plus vite.
      var dateInput = $("#a-date");
      if (dateInput && !dateInput.value) dateInput.value = aujourdhuiISO();
      montrerVue("ajout");
    });
  }
  var btnBackDetail = $("[data-back-detail]");
  if (btnBackDetail) btnBackDetail.addEventListener("click", function () { montrerVue("liste"); });
  var btnBackAdd = $("[data-back-add]");
  if (btnBackAdd) btnBackAdd.addEventListener("click", function () { montrerVue("liste"); });

  document.querySelectorAll("[data-period]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      periode = btn.getAttribute("data-period");
      document.querySelectorAll("[data-period]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      rendreListe();
    });
  });

  /* -----------------------------------------------------------------------
     DÉMARRAGE
     --------------------------------------------------------------------- */
  remplirSelectPrestation();
  chargerListe();
})();
