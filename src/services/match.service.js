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
  const [categories, sectors] = await Promise.all([
    matchRepo.getCategoryAvailability(matchId),
    matchRepo.getSectorAvailability(matchId),
  ]);
  // Group the sectors by stand for the stadium map.
  const stands = [];
  for (const s of sectors) {
    let stand = stands.find((x) => x.standId === s.standId);
    if (!stand) {
      stand = { standId: s.standId, name: s.standName, position: s.position, sectors: [] };
      stands.push(stand);
    }
    stand.sectors.push({
      sectorId: s.sectorId, code: s.code, name: s.name, tier: s.tier, positionIndex: s.positionIndex,
      categoryId: s.categoryId, onSale: s.onSale,
      capacity: s.capacity, available: s.onSale ? s.capacity - s.sold : 0, accessibleFree: s.onSale ? s.accessibleFree : 0,
    });
  }
  return {
    ...match,
    categories: categories.map((c) => ({
      ...c, onSale: c.priceCents !== null, available: c.priceCents !== null ? c.capacity - c.sold : 0,
    })),
    stands,
  };
}

/** Seats of one sector. A sector with no price for this match is not sold online: 404. */
async function getSeatMap(matchId, sectorId) {
  const match = await matchRepo.findById(matchId);
  if (!match || match.status !== 'on_sale') throw notFound('MATCH_NOT_FOUND', 'Match not found');
  const sector = await matchRepo.findSectorForMatch(matchId, sectorId);
  if (!sector) throw notFound('SECTOR_NOT_FOUND', 'This sector is not on sale for this match');
  const seats = await matchRepo.getSeatMap(matchId, sectorId);
  return { sector, seats };
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
  // Every priced category must exist in the match's stadium (at least one sector).
  const categoryIds = data.prices.map((p) => p.categoryId);
  if ((await matchRepo.countCategoriesOfStadium(data.stadiumId, categoryIds)) !== categoryIds.length) {
    throw unprocessable('INVALID_CATEGORY', 'A priced category has no sector in this stadium');
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
