'use strict';

/* =========================================================================
   ANICK COIFFURE — /api/disponibilites
   -------------------------------------------------------------------------
   GET /api/disponibilites?date=YYYY-MM-DD&prestation=CLE
   Lit l'agenda du jour et renvoie les créneaux de départ libres POUR LA
   DURÉE de la prestation demandée.

   Réponses :
     200 { creneaux: ["09:00", …], raison: null }
     200 { creneaux: [], raison: "ferme" | "aucune_dispo" | "devis" | "passe" }
     400 { creneaux: [], erreur: "…" }   (entrée invalide)
     502 { creneaux: [], erreur: "…" }   (agenda injoignable)
   ========================================================================= */

const { getPrestation } = require('../lib/config');
const { parseDateISO, aujourdhuiISO } = require('../lib/temps');
const { calculerCreneaux } = require('../lib/creneaux');
const { evenementsDuJour } = require('../lib/google');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ creneaux: [], erreur: 'Méthode non autorisée.' });
  }

  const q = req.query || {};
  const dateISO = String(q.date || '').trim();
  const cle = String(q.prestation || '').trim();

  // --- Validation des entrées ---------------------------------------------
  if (!parseDateISO(dateISO)) {
    return res.status(400).json({ creneaux: [], erreur: 'Date invalide.' });
  }
  const prestation = getPrestation(cle);
  if (!prestation) {
    return res.status(400).json({ creneaux: [], erreur: 'Prestation inconnue.' });
  }

  // --- Cas particuliers ----------------------------------------------------
  // Prestation sur devis : pas de réservation en ligne.
  if (prestation.devis || prestation.duree == null) {
    return res.status(200).json({ creneaux: [], raison: 'devis' });
  }
  // Date entièrement passée (avant aujourd'hui, fuseau Paris).
  if (dateISO < aujourdhuiISO()) {
    return res.status(200).json({ creneaux: [], raison: 'passe' });
  }

  // --- Calcul des créneaux -------------------------------------------------
  try {
    const occupes = await evenementsDuJour(dateISO);
    const { creneaux, raison } = calculerCreneaux(dateISO, prestation.duree, occupes, new Date());
    return res.status(200).json({ creneaux, raison });
  } catch (err) {
    console.error('disponibilites:', err && err.message ? err.message : err);
    return res.status(502).json({
      creneaux: [],
      erreur: 'Agenda momentanément indisponible. Réessayez ou appelez le salon.',
    });
  }
};
