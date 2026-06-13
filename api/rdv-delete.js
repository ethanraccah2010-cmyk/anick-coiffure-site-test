'use strict';

/* =========================================================================
   ANICK COIFFURE — /api/rdv-delete
   -------------------------------------------------------------------------
   POST /api/rdv-delete  (corps JSON)  { id }
   Annule (supprime) un rendez-vous de l'agenda depuis le dashboard commerçant.

   Réponses :
     200 { ok: true }
     400 { ok: false, erreur: "…" }   (id manquant)
     401 { ok: false, erreur: "…" }   (code d'accès requis/incorrect)
     502 { ok: false, erreur: "…" }   (agenda injoignable)
   ========================================================================= */

const { supprimerEvenement } = require('../lib/google');
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
  const id = String(body.id || '').trim();
  if (!id) {
    return res.status(400).json({ ok: false, erreur: 'Identifiant du RDV manquant.' });
  }

  try {
    await supprimerEvenement(id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('rdv-delete:', err && err.message ? err.message : err);
    // Un événement déjà supprimé (410 Gone) doit être traité comme un succès.
    const code = err && err.code;
    if (code === 410 || code === 404) {
      return res.status(200).json({ ok: true });
    }
    return res.status(502).json({
      ok: false,
      erreur: 'Annulation impossible pour le moment. Réessayez dans un instant.',
    });
  }
};
