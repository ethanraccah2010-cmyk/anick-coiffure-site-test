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
     7. VALIDATION FORMULAIRE DE RDV + CONFIRMATION SIMULÉE
     --------------------------------------------------------------------- */
  var form = document.querySelector("[data-rdv-form]");
  if (form) {
    // Le message de confirmation est un voisin du <form> (pas un enfant),
    // on le cherche donc dans tout le document, pas seulement dans le form.
    var feedback = document.querySelector("[data-form-feedback]");

    function setError(field, on) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.toggle("has-error", on);
    }

    function validateField(field) {
      var valid = field.checkValidity();
      setError(field, !valid);
      return valid;
    }

    // Validation à la volée (après une première saisie).
    // On ignore les champs cachés (_subject, honeypot _gotcha) qui ne sont
    // pas dans un conteneur .field — sinon closest(".field") renvoie null.
    form.querySelectorAll(".field input, .field select, .field textarea").forEach(function (field) {
      field.addEventListener("blur", function () { validateField(field); });
      field.addEventListener("input", function () {
        var wrap = field.closest(".field");
        if (wrap && wrap.classList.contains("has-error")) {
          validateField(field);
        }
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var fields = form.querySelectorAll(".field input, .field select, .field textarea");
      var allValid = true;
      var firstInvalid = null;
      fields.forEach(function (field) {
        if (!validateField(field)) {
          allValid = false;
          if (!firstInvalid) firstInvalid = field;
        }
      });

      if (!allValid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      /* =================================================================
         ENVOI RÉEL VIA FORMSPREE (AJAX — la page ne se recharge pas)
         -----------------------------------------------------------------
         L'URL de destination vient de l'attribut action="" de la balise
         <form> (votre endpoint Formspree, modifiable dans contact.html).
         Pour changer de service plus tard (ex. EmailJS), c'est ici que
         l'on adapte l'envoi.
         ================================================================= */
      var submitBtn = form.querySelector('button[type="submit"]');
      var submitHtml = submitBtn ? submitBtn.innerHTML : "";

      function setSending(on) {
        if (!submitBtn) return;
        submitBtn.disabled = on;
        submitBtn.innerHTML = on
          ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Envoi en cours…'
          : submitHtml;
      }

      // Sécurité : si pour une raison l'action n'est pas définie, on n'envoie pas dans le vide.
      if (!form.action) {
        showFeedback("error", "Configuration manquante. Merci de nous appeler au 01 69 05 15 03.");
        return;
      }

      setSending(true);
      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (response) {
          if (response.ok) {
            showFeedback("ok");
            form.reset();
          } else {
            // Formspree renvoie un détail d'erreur en JSON
            return response.json().then(function (data) {
              var msg = (data && data.errors && data.errors.length)
                ? data.errors.map(function (e) { return e.message; }).join(" ")
                : "Une erreur est survenue. Merci de réessayer ou de nous appeler.";
              showFeedback("error", msg);
            });
          }
        })
        .catch(function () {
          showFeedback("error", "Connexion impossible. Merci de réessayer ou d'appeler le 01 69 05 15 03.");
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
      if (text && (customMsg || isError)) {
        text.textContent = customMsg ||
          "Une erreur est survenue. Merci de réessayer ou de nous appeler.";
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
