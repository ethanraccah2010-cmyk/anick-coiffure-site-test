'use strict';

/* =========================================================================
   ANICK COIFFURE — lib/creneaux.js
   -------------------------------------------------------------------------
   Calcul des créneaux libres. Logique PURE (aucun appel réseau) pour rester
   testable et identique entre l'affichage (/api/disponibilites) et la
   re-vérification anti double-réservation (/api/reserver).

   Règles : 1 seule réservation à la fois (aucun chevauchement), pas de 30 min
   entre les départs, durée variable selon la prestation, créneau retenu
   seulement s'il tient ENTIÈREMENT avant la fermeture, ne chevauche aucun
   événement, et commence dans le futur.
   ========================================================================= */

const { HORAIRES, PAS_MINUTES } = require('./config');
const { heureParisVersUTC, jourSemaine, hhmmEnMinutes, minutesEnHHMM } = require('./temps');

/* Calcule les créneaux de DÉPART libres pour une prestation donnée.
   - dateISO    : "YYYY-MM-DD" (jour demandé, heure locale Paris)
   - dureeMin   : durée de la prestation en minutes
   - occupes    : intervalles occupés [{ debut:Date, fin:Date }] (UTC)
   - maintenant : instant courant (Date) — pour exclure le passé
   Retour : { creneaux: ["09:00", …], raison: null | "ferme" | "aucune_dispo" } */
function calculerCreneaux(dateISO, dureeMin, occupes, maintenant) {
  const [annee, mois, jour] = dateISO.split('-').map(Number);
  const horaire = HORAIRES[jourSemaine(annee, mois, jour)];
  if (!horaire) return { creneaux: [], raison: 'ferme' };

  const ouverture = hhmmEnMinutes(horaire.ouverture);
  const fermeture = hhmmEnMinutes(horaire.fermeture);
  const creneaux = [];

  // On avance de PAS_MINUTES tant que la durée tient avant la fermeture.
  for (let debutMin = ouverture; debutMin + dureeMin <= fermeture; debutMin += PAS_MINUTES) {
    const debut = heureParisVersUTC(annee, mois, jour, Math.floor(debutMin / 60), debutMin % 60);
    const fin = new Date(debut.getTime() + dureeMin * 60000);

    // Pas de créneau dans le passé (utile quand date = aujourd'hui).
    if (debut.getTime() <= maintenant.getTime()) continue;

    // Aucun chevauchement avec un événement existant.
    const libre = occupes.every(function (ev) {
      return fin.getTime() <= ev.debut.getTime() || debut.getTime() >= ev.fin.getTime();
    });
    if (libre) creneaux.push(minutesEnHHMM(debutMin));
  }

  return { creneaux, raison: creneaux.length ? null : 'aucune_dispo' };
}

/* Vérifie qu'un créneau précis "HH:MM" est bien proposable et libre.
   Réutilise calculerCreneaux : un créneau accepté est forcément aligné sur
   la grille, dans les horaires, et sans chevauchement (anti double-résa). */
function creneauEstLibre(dateISO, heure, dureeMin, occupes, maintenant) {
  const res = calculerCreneaux(dateISO, dureeMin, occupes, maintenant);
  return res.creneaux.indexOf(heure) !== -1;
}

module.exports = { calculerCreneaux, creneauEstLibre };
