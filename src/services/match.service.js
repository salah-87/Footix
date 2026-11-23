'use strict';
const { withTransaction } = require('../db/pool');
const matchRepo = require('../repositories/match.repository');
const audit = require('./audit.service');
const { notFound, unprocessable, conflict } = require('../utils/errors');

const listMatches = () => matchRepo.listOnSale();

/** Public detail page: only matches that are on sale are visible. */
async function getMatchDetails(matchId) {
  const match = await matchRepo.findDetails(matchId);
  if (!match || match.status !== 'on_sale') throw notFound('MATCH_NOT_FOUND', 'Match not found');
  const stands = await matchRepo.getStandAvailability(matchId);
  return { ...match, stands: stands.map((s) => ({ ...s, available: s.capacity - s.sold })) };
}

async function getSeatMap(matchId, standId) {
  const match = await matchRepo.findById(matchId);
  if (!match || match.status !== 'on_sale') throw notFound('MATCH_NOT_FOUND', 'Match not found');
  const seats = await matchRepo.getSeatMap(matchId, standId);
  if (seats.length === 0) throw notFound('STAND_NOT_FOUND', 'This stand is not available for this match');
  return seats;
}

/** Admin: create a match with its prices, atomically. */
async function createMatch(data, actor) {
  if (data.homeTeamId === data.awayTeamId) {
    throw unprocessable('SAME_TEAM', 'A team cannot play against itself');
  }
  if (!(await matchRepo.teamsExist([data.homeTeamId, data.awayTeamId]))) {
    throw unprocessable('UNKNOWN_TEAM', 'One of the teams does not exist');
  }
  if (!(await matchRepo.stadiumExists(data.stadiumId))) {
    throw unprocessable('UNKNOWN_STADIUM', 'The stadium does not exist');
  }
  // Every priced stand must belong to the match's stadium.
  const standIds = data.prices.map((p) => p.standId);
  if ((await matchRepo.countStandsOfStadium(data.stadiumId, standIds)) !== standIds.length) {
    throw unprocessable('INVALID_STAND', 'A priced stand does not belong to this stadium');
  }

  const match = await withTransaction(async (client) => {
    const created = await matchRepo.insert(data, client);
    await matchRepo.insertPrices(created.id, data.prices, client);
    return created;
  });
  await audit.record('match.created', actor, { matchId: match.id });
  return match;
}

// Allowed status changes. "cancelled" is final.
const TRANSITIONS = { draft: ['on_sale', 'cancelled'], on_sale: ['cancelled'], cancelled: [] };

async function updateMatch(matchId, changes, actor) {
  const current = await matchRepo.findById(matchId);
  if (!current) throw notFound('MATCH_NOT_FOUND', 'Match not found');
  if (current.status === 'cancelled') {
    throw conflict('MATCH_CANCELLED', 'A cancelled match cannot be modified');
  }
  if (changes.status && changes.status !== current.status
      && !TRANSITIONS[current.status].includes(changes.status)) {
    throw conflict('INVALID_TRANSITION', `Cannot go from ${current.status} to ${changes.status}`);
  }
  const updated = await matchRepo.update(matchId, changes);
  await audit.record('match.updated', actor, { matchId, changes });
  return updated;
}

const listAllMatches = () => matchRepo.listAll();
const getReference = () => matchRepo.getReference();

module.exports = { listAllMatches, getReference, listMatches, getMatchDetails, getSeatMap, createMatch, updateMatch };
