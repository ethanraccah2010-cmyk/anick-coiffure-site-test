'use strict';

/* =========================================================================
   ANICK COIFFURE — /api/rdv-create
   -------------------------------------------------------------------------
   POST /api/rdv-create  (corps JSON)
     { prenom, nom, telephone, email?, adresse?, note?,
       prestation, dateISO, heure, dureeMin? }

   Création MANUELLE par la commerçante (cliente au téléphone).
   ⚠ Volontairement PERMISSIF :
     - AUCUNE contrainte de créneau libre, AUCUNE grille de 30 min :
       la commerçante pose le RDV à l'heure qu'elle veut.
     - On ne re-vérifie PAS le chevauchement.
   La durée vient de config.js selon la prestation ; pour une prestation
   « sur devis » (duree null), une durée explicite `dureeMin` est exigée.

   Réponses :
     200 { ok: true, id }
     400 { ok: false, erreur: "…" }   (entrée invalide)
     401 { ok: false, erreur: "…" }   (code d'accès requis/incorrect)
     502 { ok: false, erreur: "…" }   (agenda injoignable)
   ========================================================================= */

const { getPrestation } = require('../lib/config');
const { parseDateISO, hhmmEnMinutes } = require('../lib/temps');
const { creerEvenement } = require('../lib/google');
const { refuserSiNonAutorise } = require('../lib/auth');

/* Lit le corps JSON de façon robuste (même logique que /api/reserver). */
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

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }
  if (refuserSiNonAutorise(req, res)) return;

  const body = await lireCorps(req);

  const prenom = String(body.prenom || '').trim();
  const nom = String(body.nom || '').trim();
  const telephone = String(body.telephone || '').trim();
  const email = String(body.email || '').trim();
  const adresse = String(body.adresse || '').trim();
  const note = String(body.note || '').trim();
  const cle = String(body.prestation || '').trim();
  const dateISO = String(body.dateISO || body.date || '').trim();
  const heure = String(body.heure || '').trim();

  // --- Validations (minimales : la commerçante reste libre sur l'horaire) --
  if (!prenom || !nom) {
    return res.status(400).json({ ok: false, erreur: 'Prénom et nom requis.' });
  }
  if (telephone.replace(/[^\d]/g, '').length < 6) {
    return res.status(400).json({ ok: false, erreur: 'Numéro de téléphone invalide.' });
  }
  if (!parseDateISO(dateISO)) {
    return res.status(400).json({ ok: false, erreur: 'Date invalide.' });
  }
  if (hhmmEnMinutes(heure) == null) {
    return res.status(400).json({ ok: false, erreur: 'Heure invalide (format HH:MM).' });
  }
  const prestation = getPrestation(cle);
  if (!prestation) {
    return res.status(400).json({ ok: false, erreur: 'Prestation inconnue.' });
  }

  // Durée : config.js, sauf prestation sur devis -> dureeMin explicite requise.
  let dureeMin = prestation.duree;
  if (dureeMin == null) {
    dureeMin = parseInt(body.dureeMin, 10);
    if (!Number.isFinite(dureeMin) || dureeMin <= 0) {
      return res.status(400).json({
        ok: false,
        erreur: 'Cette prestation est sur devis : précisez une durée en minutes.',
      });
    }
  }

  // --- Création (sans aucune vérification de disponibilité, c'est voulu) ----
  try {
    const id = await creerEvenement({
      dateISO, heure, dureeMin,
      prestation, cle,
      prenom, nom, email, telephone, adresse, note,
      source: 'commercant',
    });
    return res.status(200).json({ ok: true, id: id });
  } catch (err) {
    console.error('rdv-create:', err && err.message ? err.message : err);
    return res.status(502).json({
      ok: false,
      erreur: 'Création impossible pour le moment. Réessayez dans un instant.',
    });
  }
};
