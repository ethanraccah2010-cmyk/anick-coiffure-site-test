'use strict';

/* =========================================================================
   ANICK COIFFURE — lib/google.js
   -------------------------------------------------------------------------
   Authentification OAuth (refresh token, PAS de compte de service) et accès
   à l'agenda Google. Tous les secrets viennent des variables d'environnement
   Vercel : rien n'est écrit en dur, rien n'est commité.
     GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_REFRESH_TOKEN · GOOGLE_CALENDAR_ID
   ========================================================================= */

const { google } = require('googleapis');
const { TIMEZONE } = require('./config');
const { heureParisVersUTC } = require('./temps');

/* Client OAuth2 authentifié à partir du refresh token. */
function getAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Configuration Google manquante (variables d\'environnement absentes).');
  }
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oauth2;
}

/* Client Google Calendar prêt à l'emploi. */
function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

/* Identifiant de l'agenda visé (par défaut l'agenda principal du compte). */
function calendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

/* Récupère les intervalles occupés [{ debut, fin }] (UTC) pour un jour Paris.
   Couvre toute la journée locale et traite les événements « journée entière ». */
async function evenementsDuJour(dateISO) {
  const [annee, mois, jour] = dateISO.split('-').map(Number);
  const debutJour = heureParisVersUTC(annee, mois, jour, 0, 0);
  // Fin de journée locale (23h59) + 1 min pour inclure la dernière minute.
  const finJour = new Date(heureParisVersUTC(annee, mois, jour, 23, 59).getTime() + 60000);

  const cal = getCalendar();
  const { data } = await cal.events.list({
    calendarId: calendarId(),
    timeMin: debutJour.toISOString(),
    timeMax: finJour.toISOString(),
    singleEvents: true,      // déplie les événements récurrents
    orderBy: 'startTime',
    maxResults: 250,
  });

  const occupes = [];
  for (const ev of data.items || []) {
    if (ev.status === 'cancelled') continue;        // annulé : ignoré
    if (ev.transparency === 'transparent') continue; // marqué « disponible » : ignoré

    if (ev.start && ev.start.dateTime) {
      // Événement horodaté classique.
      occupes.push({ debut: new Date(ev.start.dateTime), fin: new Date(ev.end.dateTime) });
    } else if (ev.start && ev.start.date) {
      // Événement « journée entière » : bloque toute la journée locale.
      occupes.push({ debut: debutJour, fin: finJour });
    }
  }
  return occupes;
}

/* Crée l'événement de réservation et renvoie son id Google. */
async function creerEvenement(opts) {
  const { dateISO, heure, dureeMin, prestation, prenom, nom, email, telephone, message } = opts;
  const [annee, mois, jour] = dateISO.split('-').map(Number);
  const [h, mi] = heure.split(':').map(Number);
  const debut = heureParisVersUTC(annee, mois, jour, h, mi);
  const fin = new Date(debut.getTime() + dureeMin * 60000);

  const description = [
    'Prestation : ' + prestation.libelle + ' (' + dureeMin + ' min)',
    'Client : ' + prenom + ' ' + nom,
    'Email : ' + email,
    'Téléphone : ' + telephone,
    message ? '\nMessage :\n' + message : '',
  ].filter(Boolean).join('\n');

  const cal = getCalendar();
  const { data } = await cal.events.insert({
    calendarId: calendarId(),
    requestBody: {
      summary: 'RDV ' + prestation.libelle + ' — ' + prenom + ' ' + nom,
      description: description,
      start: { dateTime: debut.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: fin.toISOString(), timeZone: TIMEZONE },
    },
  });
  return data.id;
}

module.exports = { evenementsDuJour, creerEvenement };
