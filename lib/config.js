'use strict';

/* =========================================================================
   ANICK COIFFURE — lib/config.js
   -------------------------------------------------------------------------
   SOURCE UNIQUE DE VÉRITÉ partagée par les deux fonctions Vercel
   (/api/disponibilites et /api/reserver) ET référence pour les durées
   affichées sur prestations.html.

   ⚠ Les durées (en minutes) servent au calcul automatique des créneaux.
     En confirmation automatique, une durée fausse = risque de
     double-réservation. À confirmer avec Anick avant mise en production.
   ========================================================================= */

/* Fuseau horaire du salon — TOUS les calculs d'horaires s'y réfèrent. */
const TIMEZONE = 'Europe/Paris';

/* Pas entre deux débuts de créneaux proposés (en minutes) : 9h00, 9h30, … */
const PAS_MINUTES = 30;

/* Téléphone du salon, repris dans les messages d'erreur / de devis. */
const TELEPHONE = '01 69 05 15 03';

/* -------------------------------------------------------------------------
   HORAIRES D'OUVERTURE par jour de la semaine.
   Index = getUTCDay() : 0 = dimanche … 6 = samedi.
   null = fermé. Sinon { ouverture, fermeture } en heure locale "HH:MM".
   Lun fermé · Mar–Ven 9h–19h · Sam 9h–18h · Dim fermé.
   ------------------------------------------------------------------------- */
const HORAIRES = [
  null,                                        // 0 Dimanche — fermé
  null,                                        // 1 Lundi — fermé
  { ouverture: '09:00', fermeture: '19:00' },  // 2 Mardi
  { ouverture: '09:00', fermeture: '19:00' },  // 3 Mercredi
  { ouverture: '09:00', fermeture: '19:00' },  // 4 Jeudi
  { ouverture: '09:00', fermeture: '19:00' },  // 5 Vendredi
  { ouverture: '09:00', fermeture: '18:00' },  // 6 Samedi
];

/* -------------------------------------------------------------------------
   TABLE DES PRESTATIONS.
   - libelle : nom lisible (titre de l'événement agenda)
   - prix    : texte affiché (indicatif)
   - duree   : durée en minutes (null = sur devis : pas de réservation en ligne)
   - devis   : true => prestation sur devis, jamais réservable en ligne
   La clé de l'objet est l'identifiant stable employé par le formulaire/API.
   ------------------------------------------------------------------------- */
const PRESTATIONS = {
  diagnostic:       { libelle: 'Diagnostic & conseil personnalisé',    prix: 'Offert',    duree: 20 },
  soin_hydratation: { libelle: 'Soin hydratation profonde',            prix: 'dès 25 €',  duree: 45 },
  soin_proteine:    { libelle: 'Soin protéiné / reconstruction',       prix: 'dès 35 €',  duree: 60 },
  rituel_cuir:      { libelle: 'Rituel cuir chevelu & massage',        prix: 'dès 30 €',  duree: 45 },
  coupe_femme:      { libelle: 'Coupe femme + coiffage',               prix: 'dès 35 €',  duree: 60 },
  coupe_boucles:    { libelle: 'Coupe bouclés / afro (méthode à sec)', prix: 'dès 45 €',  duree: 90 },
  brushing:         { libelle: 'Brushing',                             prix: 'dès 30 €',  duree: 60 },
  wash_go:          { libelle: 'Wash & Go / définition des boucles',   prix: 'dès 40 €',  duree: 60 },
  evenementiel:     { libelle: 'Coiffure événementielle (mariage…)',   prix: 'sur devis', duree: null, devis: true },
  box_braids:       { libelle: 'Box braids / tresses collées',         prix: 'dès 70 €',  duree: 240 },
  vanilles:         { libelle: 'Vanilles & twists',                    prix: 'dès 65 €',  duree: 180 },
  tissage:          { libelle: "Tissage / pose d'extensions",          prix: 'dès 90 €',  duree: 150 },
  nattes_enfant:    { libelle: 'Nattes & coiffures enfant',            prix: 'dès 30 €',  duree: 45 },
  color_racines:    { libelle: 'Coloration racines',                   prix: 'dès 40 €',  duree: 75 },
  color_complete:   { libelle: 'Coloration complète',                  prix: 'dès 55 €',  duree: 120 },
  balayage:         { libelle: 'Balayage / mèches',                    prix: 'dès 70 €',  duree: 150 },
  patine:           { libelle: 'Patine / gloss',                       prix: 'dès 30 €',  duree: 45 },
};

/* Renvoie la prestation correspondant à une clé, ou null si inconnue. */
function getPrestation(cle) {
  if (!cle || !Object.prototype.hasOwnProperty.call(PRESTATIONS, cle)) return null;
  return PRESTATIONS[cle];
}

/* Format lisible d'une durée : 20 -> "20 min", 60 -> "1 h", 150 -> "2 h 30".
   Utilisé pour les messages serveur ; prestations.html reprend ces valeurs. */
function formatDuree(min) {
  if (min == null) return 'durée variable';
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? h + ' h' : h + ' h ' + (m < 10 ? '0' + m : m);
}

module.exports = {
  TIMEZONE,
  PAS_MINUTES,
  TELEPHONE,
  HORAIRES,
  PRESTATIONS,
  getPrestation,
  formatDuree,
};
