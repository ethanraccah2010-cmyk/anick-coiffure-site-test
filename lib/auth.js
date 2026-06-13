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

/* true si la requête est autorisée à appeler une fonction admin.
   On « trim » les deux valeurs : un espace ou un retour-à-la-ligne collé par
   erreur dans la variable Vercel (cas fréquent) ne doit pas casser l'égalité,
   et une variable contenant uniquement des espaces compte comme vide (test). */
function dashboardAutorise(req) {
  const attendu = String(process.env.DASHBOARD_PASSWORD || '').trim();
  if (!attendu) return true; // pas de mot de passe configuré => libre (test)
  const fourni = String(req.headers['x-dashboard-password'] || '').trim();
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
