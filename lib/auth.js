'use strict';

/* =========================================================================
   ANICK COIFFURE — lib/auth.js
   -------------------------------------------------------------------------
   Authentification (volontairement simple) du tableau de bord commerçant.

   Pilotée par la variable d'environnement DASHBOARD_PASSWORD :
     - VIDE ou absente -> aucune authentification (mode test actuel) ;
     - REMPLIE         -> chaque fonction admin exige le header
                          "x-dashboard-password" et renvoie 401 sinon.

   Objectif : tester aujourd'hui sans code, puis sécuriser le jour de la
   livraison en remplissant simplement la variable sur Vercel — sans recoder.
   ========================================================================= */

/* true si la requête est autorisée à appeler une fonction admin. */
function dashboardAutorise(req) {
  const attendu = process.env.DASHBOARD_PASSWORD;
  if (!attendu) return true; // pas de mot de passe configuré => libre (test)
  const fourni = req.headers['x-dashboard-password'];
  return fourni === attendu;
}

/* Renvoie une réponse 401 standard et true si la requête n'est pas autorisée.
   À appeler en tête de chaque fonction admin :
     if (refuserSiNonAutorise(req, res)) return; */
function refuserSiNonAutorise(req, res) {
  if (dashboardAutorise(req)) return false;
  res.status(401).json({ ok: false, erreur: 'Code d\'accès requis ou incorrect.' });
  return true;
}

module.exports = { dashboardAutorise, refuserSiNonAutorise };
