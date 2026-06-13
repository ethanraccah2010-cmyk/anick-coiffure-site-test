'use strict';

/* =========================================================================
   ANICK COIFFURE — /api/rdv-list
   -------------------------------------------------------------------------
   GET /api/rdv-list?jours=30
   Liste les rendez-vous À VENIR (à partir de maintenant) sur une plage de
   `jours` jours (défaut 30), pour le tableau de bord commerçant.

   - Lit les événements via lib/google.listerEvenements (annulés et
     « disponibles » déjà filtrés).
   - Reconstruit prestationLibelle et dureeMin depuis lib/config à partir de
     la clé stockée dans extendedProperties.private.prestation ;
     si absente, retombe sur le summary / la durée réelle de l'événement.
   - Trié par date/heure croissante.

   Réponses :
     200 { ok: true, rdv: [ { id, dateISO, heureDebut, heureFin, dureeMin,
            prestationLibelle, prenom, nom, email, telephone, adresse, note,
            source } ] }
     401 { ok: false, erreur: "…" }   (code d'accès requis/incorrect)
     502 { ok: false, erreur: "…" }   (agenda injoignable)
   ========================================================================= */

const { getPrestation } = require('../lib/config');
const { instantVersParis } = require('../lib/temps');
const { listerEvenements } = require('../lib/google');
const { refuserSiNonAutorise } = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }
  if (refuserSiNonAutorise(req, res)) return;

  // Plage : de maintenant à +jours jours (borné entre 1 et 365).
  const q = req.query || {};
  let jours = parseInt(q.jours, 10);
  if (!Number.isFinite(jours) || jours < 1) jours = 30;
  if (jours > 365) jours = 365;

  const maintenant = new Date();
  const fin = new Date(maintenant.getTime() + jours * 24 * 60 * 60 * 1000);

  try {
    const items = await listerEvenements(maintenant.toISOString(), fin.toISOString());

    const rdv = items.map(function (ev) {
      // Instant de début/fin (UTC) -> heure murale de Paris.
      const debutDate = ev.start && ev.start.dateTime
        ? new Date(ev.start.dateTime)
        : new Date(ev.start.date + 'T00:00:00Z'); // journée entière (cas rare)
      const finDate = ev.end && ev.end.dateTime
        ? new Date(ev.end.dateTime)
        : new Date(debutDate.getTime() + 60 * 60000);

      const pDebut = instantVersParis(debutDate);
      const pFin = instantVersParis(finDate);

      const prive = (ev.extendedProperties && ev.extendedProperties.private) || {};
      const prestation = getPrestation(prive.prestation);

      // Durée : config si la clé est connue, sinon écart réel début/fin.
      const dureeMin = prestation && prestation.duree != null
        ? prestation.duree
        : Math.max(0, Math.round((finDate.getTime() - debutDate.getTime()) / 60000));

      // Libellé : config si connue, sinon le résumé de l'événement.
      const prestationLibelle = prestation
        ? prestation.libelle
        : (ev.summary || 'Rendez-vous');

      return {
        id: ev.id,
        dateISO: pDebut.dateISO,
        heureDebut: pDebut.heure,
        heureFin: pFin.heure,
        dureeMin: dureeMin,
        prestationLibelle: prestationLibelle,
        prestationCle: prive.prestation || '',
        prenom: prive.prenom || '',
        nom: prive.nom || '',
        email: prive.email || '',
        telephone: prive.telephone || '',
        adresse: prive.adresse || '',
        note: prive.note || '',
        source: prive.source || 'client',
      };
    });

    // Tri par date puis heure de début croissantes.
    rdv.sort(function (a, b) {
      if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? -1 : 1;
      return a.heureDebut < b.heureDebut ? -1 : (a.heureDebut > b.heureDebut ? 1 : 0);
    });

    return res.status(200).json({ ok: true, rdv: rdv });
  } catch (err) {
    console.error('rdv-list:', err && err.message ? err.message : err);
    return res.status(502).json({
      ok: false,
      erreur: 'Agenda momentanément indisponible. Réessayez dans un instant.',
    });
  }
};
