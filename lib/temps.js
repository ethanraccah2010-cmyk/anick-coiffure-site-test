'use strict';

/* =========================================================================
   ANICK COIFFURE — lib/temps.js
   -------------------------------------------------------------------------
   Outils de fuseau horaire SANS dépendance externe.
   Sur Vercel, les fonctions Node tournent en UTC : il faut convertir entre
   l'heure « murale » d'Europe/Paris (ce que voit le client) et les instants
   UTC (ce que renvoie Google Agenda). On s'appuie sur Intl.DateTimeFormat,
   intégré à Node, qui gère nativement l'heure d'été/hiver.
   ========================================================================= */

const { TIMEZONE } = require('./config');

/* Décalage (en minutes) dont TIMEZONE est en avance sur UTC à l'instant `date`.
   Paris : +60 (hiver) ou +120 (été). */
function decalageMinutes(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0; // certains environnements renvoient "24" pour minuit
  const murAsUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second)
  );
  return Math.round((murAsUTC - date.getTime()) / 60000);
}

/* Convertit une heure murale de Paris (année, mois 1-12, jour, h, min) en
   instant UTC (objet Date). Recalcule le décalage au plus près pour gérer
   proprement les bascules d'heure d'été. */
function heureParisVersUTC(annee, mois, jour, h, min) {
  const guess = Date.UTC(annee, mois - 1, jour, h, min, 0);
  const off1 = decalageMinutes(new Date(guess));
  let utc = guess - off1 * 60000;
  const off2 = decalageMinutes(new Date(utc));
  if (off2 !== off1) utc = guess - off2 * 60000;
  return new Date(utc);
}

/* Jour de la semaine (0=dimanche … 6=samedi) d'une date calendaire. */
function jourSemaine(annee, mois, jour) {
  return new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay();
}

/* Parse "YYYY-MM-DD" -> { annee, mois, jour } ou null si invalide. */
function parseDateISO(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const annee = Number(m[1]), mois = Number(m[2]), jour = Number(m[3]);
  // Cohérence calendaire (rejette p.ex. le 31 février)
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) {
    return null;
  }
  return { annee, mois, jour };
}

/* "HH:MM" -> minutes depuis minuit, ou null si invalide. */
function hhmmEnMinutes(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/* minutes depuis minuit -> "HH:MM". */
function minutesEnHHMM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
}

/* Date calendaire "YYYY-MM-DD" du jour courant dans le fuseau du salon. */
function aujourdhuiISO() {
  // en-CA produit un format "YYYY-MM-DD".
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/* Convertit un instant UTC (Date, ex. start.dateTime d'un événement Google) en
   heure murale de Paris -> { dateISO: "YYYY-MM-DD", heure: "HH:MM" }.
   Utilisé par le dashboard pour réafficher les RDV à l'heure locale du salon. */
function instantVersParis(date) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const parts = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  let heure = parts.hour;
  if (heure === '24') heure = '00'; // minuit renvoyé "24" sur certains runtimes
  return {
    dateISO: parts.year + '-' + parts.month + '-' + parts.day,
    heure: heure + ':' + parts.minute,
  };
}

module.exports = {
  decalageMinutes,
  heureParisVersUTC,
  jourSemaine,
  parseDateISO,
  hhmmEnMinutes,
  minutesEnHHMM,
  aujourdhuiISO,
  instantVersParis,
};
