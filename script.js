/* =========================================================================
   ANICK COIFFURE — script.js (JavaScript vanilla, aucune dépendance)
   -------------------------------------------------------------------------
   1. Navigation mobile (hamburger)
   2. Ombre de nav au scroll
   3. Reveal au scroll (IntersectionObserver)
   4. Année du footer automatique
   5. Fallback images manquantes → placeholder élégant (pas d'image cassée)
   6. Lightbox galerie
   7. Validation du formulaire de RDV + confirmation simulée
   ========================================================================= */
(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     1. NAVIGATION MOBILE (hamburger)
     --------------------------------------------------------------------- */
  var nav = document.querySelector("[data-nav]");
  var toggle = document.querySelector("[data-nav-toggle]");

  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Ferme le menu mobile quand on clique un lien
    nav.querySelectorAll(".nav__mobile a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });

    // Ferme avec Echap
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* -----------------------------------------------------------------------
     2. OMBRE DE NAV AU SCROLL
     --------------------------------------------------------------------- */
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* -----------------------------------------------------------------------
     3. REVEAL AU SCROLL (IntersectionObserver)
     --------------------------------------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reveals.length && "IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    // Fallback : tout visible si pas d'IO ou mouvement réduit
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* -----------------------------------------------------------------------
     4. ANNÉE DU FOOTER AUTOMATIQUE
     --------------------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* -----------------------------------------------------------------------
     5. FALLBACK IMAGES MANQUANTES → PLACEHOLDER ÉLÉGANT
     --------------------------------------------------------------------- */
  // Construit le HTML d'un placeholder doux (cohérent avec .img-ph en CSS).
  function placeholderMarkup(label) {
    return (
      '<div class="img-ph" role="img" aria-label="' + (label || "Photo à venir") + '">' +
        '<div class="img-ph__inner">' +
          '<i class="fa-solid fa-scissors" aria-hidden="true"></i>' +
          '<span>Anick Coiffure</span>' +
          '<small>Photo à venir</small>' +
        '</div>' +
      '</div>'
    );
  }

  // Remplace une <img> cassée par le placeholder, en conservant le conteneur.
  function swapToPlaceholder(img) {
    var label = img.getAttribute("alt") || "Photo à venir";
    var ph = document.createElement("div");
    ph.innerHTML = placeholderMarkup(label);
    var node = ph.firstChild;
    // Reprend d'éventuelles classes utiles du parent immédiat déjà gérées en CSS.
    if (img.parentNode) {
      img.parentNode.replaceChild(node, img);
    }
  }

  document.querySelectorAll("img[data-fallback]").forEach(function (img) {
    // Pas de src → placeholder direct
    if (!img.getAttribute("src")) {
      swapToPlaceholder(img);
      return;
    }
    // IMPORTANT : ce script étant en bas de page, l'image a souvent DÉJÀ fini
    // de charger (ou échoué) quand on arrive ici. Dans ce cas l'évènement
    // "error" est déjà passé et ne se redéclenchera pas — il faut donc tester
    // tout de suite si l'image est cassée/vide.
    if (img.complete) {
      if (img.naturalWidth === 0) { swapToPlaceholder(img); }
      return;
    }
    // Sinon, l'image est encore en cours de chargement : on écoute la suite.
    img.addEventListener("error", function () { swapToPlaceholder(img); });
    img.addEventListener("load", function () {
      if (img.naturalWidth === 0) { swapToPlaceholder(img); }
    });
  });

  /* -----------------------------------------------------------------------
     6. LIGHTBOX GALERIE (vanilla, sans librairie)
     --------------------------------------------------------------------- */
  var lightbox = document.querySelector("[data-lightbox]");
  if (lightbox) {
    var lbWrap = lightbox.querySelector(".lightbox__img-wrap");
    var btnClose = lightbox.querySelector(".lightbox__close");
    var btnPrev = lightbox.querySelector(".lightbox__prev");
    var btnNext = lightbox.querySelector(".lightbox__next");
    var cells = Array.prototype.slice.call(document.querySelectorAll("[data-lb-item]"));
    var current = 0;

    function renderSlide(index) {
      var cell = cells[index];
      if (!cell) return;
      var img = cell.querySelector("img");
      lbWrap.innerHTML = "";
      if (img && img.getAttribute("src") && img.naturalWidth !== 0) {
        var big = document.createElement("img");
        big.src = img.getAttribute("src");
        big.alt = img.getAttribute("alt") || "Réalisation Anick Coiffure";
        lbWrap.appendChild(big);
      } else {
        // Reflète le placeholder dans la lightbox
        lbWrap.innerHTML = placeholderMarkup(
          (img && img.getAttribute("alt")) || "Photo à venir"
        );
      }
    }

    function openAt(index) {
      current = index;
      renderSlide(current);
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      btnClose.focus();
    }
    function close() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    function go(dir) {
      current = (current + dir + cells.length) % cells.length;
      renderSlide(current);
    }

    cells.forEach(function (cell, i) {
      cell.addEventListener("click", function () { openAt(i); });
      cell.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAt(i); }
      });
    });

    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", function () { go(-1); });
    btnNext.addEventListener("click", function () { go(1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) close();
    });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    });
  }

  /* -----------------------------------------------------------------------
     7. RÉSERVATION EN LIGNE (créneaux dynamiques + Google Agenda)
     -----------------------------------------------------------------------
     - Date + prestation choisies  -> GET /api/disponibilites (créneaux libres)
     - Créneau cliqué + champs OK   -> POST /api/reserver (crée le RDV)
     On réutilise showFeedback() pour les retours, on garde le honeypot _gotcha.
     --------------------------------------------------------------------- */
  var form = document.querySelector("[data-rdv-form]");
  if (form) {
    // Le message de confirmation est un voisin du <form> (pas un enfant).
    var feedback = document.querySelector("[data-form-feedback]");
    // Texte de succès par défaut (placé dans le HTML) — mémorisé pour pouvoir
    // le restaurer après l'affichage d'un message d'erreur personnalisé.
    var defaultOkMsg = feedback ? feedback.querySelector("span").textContent : "";
    var TEL = "01 69 05 15 03";

    var prestationSel = form.querySelector('[name="prestation"]');
    var dateInput = form.querySelector('[name="date"]');
    var slotsWrap = form.querySelector("[data-slots]");
    var creneauField = form.querySelector("[data-creneau-field]");
    var creneauInput = form.querySelector("[data-creneau-value]");
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitHtml = submitBtn ? submitBtn.innerHTML : "";
    var selectedSlot = null;   // "HH:MM" choisi par le client
    var dispoToken = 0;        // anti course : ignore les réponses obsolètes

    // Empêche le choix d'une date passée (min = aujourd'hui, fuseau Paris).
    if (dateInput) {
      dateInput.min = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    }

    function setError(field, on) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.toggle("has-error", on);
    }

    function validateField(field) {
      var valid = field.checkValidity();
      setError(field, !valid);
      return valid;
    }

    // Validation à la volée (après une première saisie). On ignore le honeypot
    // et l'input caché du créneau qui ne sont pas des champs visibles.
    form.querySelectorAll(".field input:not([type=hidden]), .field select, .field textarea").forEach(function (field) {
      field.addEventListener("blur", function () { validateField(field); });
      field.addEventListener("input", function () {
        var wrap = field.closest(".field");
        if (wrap && wrap.classList.contains("has-error")) {
          validateField(field);
        }
      });
    });

    /* --- Gestion de la zone de créneaux ---------------------------------- */

    function estDevis() {
      return prestationSel && prestationSel.value === "evenementiel";
    }

    // Affiche un message d'état (astuce, chargement, info, erreur) à la place
    // des créneaux. kind : "hint" | "loading" | "info" | "error".
    function setSlotsMessage(text, kind) {
      if (!slotsWrap) return;
      slotsWrap.innerHTML = "";
      var p = document.createElement("p");
      p.className = "slots__hint" + (kind === "error" ? " is-error" : "");
      if (kind === "loading") {
        p.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ';
        p.appendChild(document.createTextNode(text));
      } else {
        p.textContent = text;
      }
      slotsWrap.appendChild(p);
    }

    function clearSelection() {
      selectedSlot = null;
      if (creneauInput) creneauInput.value = "";
      if (creneauField) creneauField.classList.remove("has-error");
    }

    function selectSlot(heure, btn) {
      selectedSlot = heure;
      if (creneauInput) creneauInput.value = heure;
      if (creneauField) creneauField.classList.remove("has-error");
      slotsWrap.querySelectorAll(".slot").forEach(function (s) {
        s.classList.remove("is-selected");
        s.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
    }

    // Construit les boutons-créneaux cliquables.
    function renderSlots(liste) {
      slotsWrap.innerHTML = "";
      liste.forEach(function (heure) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.textContent = heure;
        b.setAttribute("data-slot", heure);
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { selectSlot(heure, b); });
        slotsWrap.appendChild(b);
      });
    }

    // Active/désactive le bouton d'envoi (désactivé tant qu'on est sur devis).
    function lockSubmit(forced) {
      if (submitBtn) submitBtn.disabled = forced || estDevis();
    }

    // Recharge les créneaux dès que la prestation OU la date change.
    function onCriteriaChange() {
      clearSelection();

      if (estDevis()) {
        setSlotsMessage("Cette prestation se réserve sur devis — appelez le " + TEL + ".", "info");
        lockSubmit(true);
        return;
      }
      lockSubmit(false);

      if (!prestationSel.value || !dateInput.value) {
        setSlotsMessage("Choisissez une prestation et une date pour voir les créneaux.", "hint");
        return;
      }
      fetchDispo(dateInput.value, prestationSel.value);
    }

    // Interroge l'API des disponibilités et affiche le résultat.
    function fetchDispo(date, prestation) {
      var token = ++dispoToken;
      setSlotsMessage("Recherche des créneaux disponibles…", "loading");

      fetch("/api/disponibilites?date=" + encodeURIComponent(date) +
            "&prestation=" + encodeURIComponent(prestation),
            { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (token !== dispoToken) return; // une requête plus récente a pris le relais
          if (!res.ok) {
            setSlotsMessage((res.data && res.data.erreur) || "Impossible de charger les créneaux.", "error");
            return;
          }
          var d = res.data || {};
          if (d.raison === "devis") {
            setSlotsMessage("Cette prestation se réserve sur devis — appelez le " + TEL + ".", "info");
            lockSubmit(true);
            return;
          }
          if (d.raison === "ferme") {
            setSlotsMessage("Le salon est fermé ce jour-là. Choisissez une autre date.", "info");
            return;
          }
          if (d.raison === "passe") {
            setSlotsMessage("Cette date est déjà passée, merci d'en choisir une autre.", "info");
            return;
          }
          if (!d.creneaux || !d.creneaux.length) {
            setSlotsMessage("Aucun créneau disponible ce jour. Essayez une autre date.", "info");
            return;
          }
          renderSlots(d.creneaux);
        })
        .catch(function () {
          if (token !== dispoToken) return;
          setSlotsMessage("Impossible de charger les créneaux. Réessayez ou appelez le " + TEL + ".", "error");
        });
    }

    if (prestationSel) prestationSel.addEventListener("change", onCriteriaChange);
    if (dateInput) {
      dateInput.addEventListener("change", onCriteriaChange);
      dateInput.addEventListener("input", onCriteriaChange);
    }

    /* --- Soumission : création du rendez-vous ---------------------------- */

    function setSending(on) {
      if (!submitBtn) return;
      submitBtn.disabled = on || estDevis();
      submitBtn.innerHTML = on
        ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Réservation en cours…'
        : submitHtml;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Prestation sur devis : aucune réservation en ligne.
      if (estDevis()) {
        showFeedback("error", "Cette prestation se réserve sur devis — appelez le " + TEL + ".");
        return;
      }

      // Valide les champs visibles (prénom, nom, email, tél, prestation, date).
      var fields = form.querySelectorAll(".field input:not([type=hidden]), .field select, .field textarea");
      var allValid = true;
      var firstInvalid = null;
      fields.forEach(function (field) {
        if (!validateField(field)) {
          allValid = false;
          if (!firstInvalid) firstInvalid = field;
        }
      });

      // Valide qu'un créneau a bien été choisi.
      if (!selectedSlot) {
        if (creneauField) creneauField.classList.add("has-error");
        allValid = false;
        if (!firstInvalid && slotsWrap) {
          slotsWrap.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        }
      }

      if (!allValid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      var payload = {
        date: dateInput.value,
        heure: selectedSlot,
        prestation: prestationSel.value,
        prenom: form.prenom ? form.prenom.value.trim() : "",
        nom: form.nom ? form.nom.value.trim() : "",
        email: form.email ? form.email.value.trim() : "",
        telephone: form.telephone ? form.telephone.value.trim() : "",
        message: form.message ? form.message.value.trim() : "",
        _gotcha: form._gotcha ? form._gotcha.value : ""
      };

      setSending(true);
      fetch("/api/reserver", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (res.ok && res.data && res.data.ok) {
            showFeedback("ok");
            form.reset();
            clearSelection();
            setSlotsMessage("Choisissez une prestation et une date pour voir les créneaux.", "hint");
          } else if (res.status === 409) {
            // Créneau pris entre-temps : on prévient et on recharge les dispos.
            showFeedback("error", (res.data && res.data.erreur) ||
              "Ce créneau vient d'être réservé. Merci d'en choisir un autre.");
            onCriteriaChange();
          } else {
            showFeedback("error", (res.data && res.data.erreur) ||
              "Une erreur est survenue. Réessayez ou appelez le " + TEL + ".");
          }
        })
        .catch(function () {
          showFeedback("error", "Connexion impossible. Réessayez ou appelez le " + TEL + ".");
        })
        .finally(function () {
          setSending(false);
        });
    });

    /* Affiche le message de confirmation (ok) ou d'erreur sous le formulaire.
       type : "ok" | "error" · customMsg : texte optionnel (sinon message par défaut). */
    function showFeedback(type, customMsg) {
      if (!feedback) {
        if (type === "error") alert(customMsg || "Une erreur est survenue.");
        return;
      }
      var icon = feedback.querySelector("i");
      var text = feedback.querySelector("span");
      var isError = type === "error";

      feedback.classList.toggle("is-error", isError);
      if (icon) {
        icon.className = isError
          ? "fa-solid fa-circle-exclamation"
          : "fa-solid fa-circle-check";
      }
      // On rétablit toujours le bon texte (évite qu'un ancien message d'erreur
      // reste affiché lors d'un succès ultérieur).
      if (text) {
        text.textContent = customMsg || (isError
          ? "Une erreur est survenue. Réessayez ou appelez le " + TEL + "."
          : defaultOkMsg);
      }

      feedback.classList.add("is-visible");
      feedback.setAttribute("role", isError ? "alert" : "status");
      feedback.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });

      // Le message de succès disparaît après quelques secondes ; l'erreur reste.
      if (!isError) {
        window.setTimeout(function () {
          feedback.classList.remove("is-visible");
        }, 9000);
      }
    }
  }
})();
