'use strict';

/* =========================================================================
   ANICK COIFFURE — /api/reserver
   -------------------------------------------------------------------------
   POST /api/reserver  (corps JSON)
     { date, heure, prestation, prenom, nom, email, telephone, message }

   - Recalcule la durée CÔTÉ SERVEUR depuis la clé prestation (on ne fait
     jamais confiance à une durée envoyée par le navigateur).
   - Revérifie que [début, début+durée] est libre juste avant d'écrire
     (anti double-réservation simultanée).
   - Crée l'événement => confirmation automatique.

   Réponses :
     200 { ok: true }
     400 { ok: false, erreur: "…" }   (entrée invalide / sur devis / date passée)
     409 { ok: false, erreur: "…" }   (créneau pris entre-temps)
     502 { ok: false, erreur: "…" }   (agenda injoignable)
   ========================================================================= */

const { getPrestation, TELEPHONE } = require('../lib/config');
const { parseDateISO, hhmmEnMinutes, aujourdhuiISO } = require('../lib/temps');
const { creneauEstLibre } = require('../lib/creneaux');
const { evenementsDuJour, creerEvenement } = require('../lib/google');

/* Lit le corps JSON de la requête de façon robuste (selon le runtime Vercel,
   req.body peut déjà être un objet, une chaîne, ou rien). */
async function lireCorps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return await new Promise(function (resolve) {
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', function () { resolve({}); });
  });
}

function emailValide(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }

  const body = await lireCorps(req);

  // Honeypot anti-spam : un bot remplit ce champ caché. On répond OK sans rien
  // créer pour ne pas lui signaler le filtrage.
  if (body._gotcha) {
    return res.status(200).json({ ok: true });
  }

  const dateISO = String(body.date || '').trim();
  const heure = String(body.heure || body.creneau || '').trim();
  const cle = String(body.prestation || '').trim();
  const prenom = String(body.prenom || '').trim();
  const nom = String(body.nom || '').trim();
  const email = String(body.email || '').trim();
  const telephone = String(body.telephone || '').trim();
  const message = String(body.message || '').trim();

  // --- Validations ---------------------------------------------------------
  if (!parseDateISO(dateISO)) {
    return res.status(400).json({ ok: false, erreur: 'Date invalide.' });
  }
  if (hhmmEnMinutes(heure) == null) {
    return res.status(400).json({ ok: false, erreur: 'Créneau invalide.' });
  }
  const prestation = getPrestation(cle);
  if (!prestation) {
    return res.status(400).json({ ok: false, erreur: 'Prestation inconnue.' });
  }
  if (prestation.devis || prestation.duree == null) {
    return res.status(400).json({
      ok: false,
      erreur: 'Cette prestation se réserve sur devis — appelez le ' + TELEPHONE + '.',
    });
  }
  if (!prenom || !nom) {
    return res.status(400).json({ ok: false, erreur: 'Prénom et nom requis.' });
  }
  if (!emailValide(email)) {
    return res.status(400).json({ ok: false, erreur: 'Email invalide.' });
  }
  if (telephone.replace(/[^\d]/g, '').length < 6) {
    return res.status(400).json({ ok: false, erreur: 'Numéro de téléphone invalide.' });
  }
  if (dateISO < aujourdhuiISO()) {
    return res.status(400).json({ ok: false, erreur: 'Cette date est déjà passée.' });
  }

  // --- Création (avec re-vérification anti double-réservation) -------------
  try {
    const occupes = await evenementsDuJour(dateISO);
    if (!creneauEstLibre(dateISO, heure, prestation.duree, occupes, new Date())) {
      return res.status(409).json({
        ok: false,
        erreur: 'Ce créneau vient d\'être réservé. Merci d\'en choisir un autre.',
      });
    }
    await creerEvenement({
      dateISO, heure, dureeMin: prestation.duree,
      prestation, cle,
      prenom, nom, email, telephone,
      adresse: '',          // le formulaire client ne demande pas d'adresse
      note: message,        // le « message » client devient la note du RDV
      source: 'client',
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('reserver:', err && err.message ? err.message : err);
    return res.status(502).json({
      ok: false,
      erreur: 'Réservation impossible pour le moment. Réessayez ou appelez le ' + TELEPHONE + '.',
    });
  }
};
