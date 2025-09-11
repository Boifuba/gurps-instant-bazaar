/**
 * @file Character currency CRUD operations
 * @description Centralized service for managing currency items directly on character sheets (GURPS/GGA)
 */

import { makeChange, _calculateBaseUnitMultiplier } from './currency.js';

/**
 * (Optional) Builds complete currency data. Useful for direct initializations.
 * In the GGA flow below, we use Equipment/toItemData and internalUpdate.
 * @param {Object} denomination - The currency denomination object
 * @param {number} [count=0] - The initial count for the coin
 * @returns {Object} Complete GURPS coin item data
 */
export function createCompleteGURPSCoinItem(denomination, count = 0) {
  const currentDate = new Date().toISOString();
  const uuid = foundry.utils.randomID(16);
  const itemId = foundry.utils.randomID(16);

  return {
    name: denomination.name,
    notes: "",
    pageref: denomination.pageref || "B264",
    count: Number.isFinite(count) ? count : 0,
    weight: Number(denomination.weight) || 0,
    cost: Number(denomination.value) || 0,
    location: "",
    carried: true,
    equipped: false,
    techlevel: denomination.techlevel ?? 1,
    categories: denomination.categories || "",
    legalityclass: denomination.legalityclass || "",
    uses: null,
    maxuses: 0,
    parentuuid: "",
    uuid,
    contains: {},
    originalName: denomination.name,
    originalCount: 0,
    ignoreImportQty: false,
    last_import: currentDate,
    save: true,
    itemid: itemId,
    img: denomination.img || "icons/svg/item-bag.svg"
  };
}

/* ============================== GGA HELPERS ============================== */

/** Path to the carried items list in the GURPS character sheet. */
const CARRIED_PATH = "system.equipment.carried";

/**
 * Reads the GGA list from the specified path.
 * @param {Actor} actor
 * @param {string} path
 * @returns {Object<string, any>} The GGA list object
 */
function readGGAList(actor, path = CARRIED_PATH) {
  return GURPS.decode(actor, path) || {};
}

/**
 * Upserts a coin via GGA. Maintains a single item per denomination, removes duplicates and preserves placeholder with count=0.
 * Creates Foundry Item when `gurps.use-foundry-items` is active.
 * @param {Actor} actor
 * @param {Object} denomination - Currency denomination object { name, value, weight, ... }
 * @param {number} count
 * @param {string} [path] - Path to the equipment list
 * @returns {Promise<void>}
 */
async function upsertCoinGGA(actor, denomination, count, path = CARRIED_PATH) {
  const { Equipment } = await import("/systems/gurps/module/actor/actor-components.js");

  const list = readGGAList(actor, path);
  const entries = Object.entries(list).filter(([_, it]) => it?.name === denomination.name);

  // First occurrence (kept)
  let keepId = entries[0]?.[0];
  const keepData = entries[0]?.[1];

  // Build the updated Equipment
  const eq = new Equipment(denomination.name, true);
  eq.count = Number(count) || 0;
  eq.cost = Number(denomination.value) || 0;
  eq.weight = Number(denomination.weight) || 0;
  eq.notes = "";
  eq.equipped = false;
  eq.carried = true;
  eq.techlevel = denomination.techlevel ?? 1;
  eq.categories = denomination.categories || "";
  eq.legalityclass = denomination.legalityclass || "";
  eq.img = denomination.img || "icons/svg/item-bag.svg";

  // Foundry Items (optional)
  if (game.settings.get("gurps", "use-foundry-items")) {
    eq.save = true;
    if (keepData?.itemid) {
      eq.itemid = keepData.itemid;
    } else {
      const type = path.split(".")[2] || "carried";
      const [item] = await actor.createEmbeddedDocuments("Item", [eq.toItemData(actor, type)]);
      eq.itemid = item._id;
    }
  }

  // GGA UUID
  eq.uuid = keepData?.uuid || eq._getGGAId({ name: eq.name, type: path.split(".")[2] || "carried", generator: "" });

  // Save/update
  if (!keepId) {
    GURPS.put(list, foundry.utils.duplicate(eq)); // creates placeholder even if count=0
  } else {
    list[keepId] = foundry.utils.duplicate(eq);
    // remove excess duplicates
    for (const [dupId] of entries.slice(1)) delete list[dupId];
  }

  await actor.internalUpdate({ [path]: list });
  if (actor.sheet?.rendered) actor.sheet.render(false);
}

/* ============================ MAIN SERVICE =========================== */

/**
 * Service for managing character currency operations
 */
export default class CharacterCurrencyService {
  /**
   * Creates a new CharacterCurrencyService instance
   * @param {string} moduleId
   * @param {number} baseUnitMultiplier
   */
  constructor(moduleId, baseUnitMultiplier) {
    this.moduleId = moduleId;
    this.baseUnitMultiplier = Number(baseUnitMultiplier) || 0;
  }

  /**
   * Calculates total currency in nominal value.
   * @param {string} actorId
   * @returns {number} Total currency value
   */
  getCharacterSheetCurrency(actorId) {
    const coins = this.getCharacterSheetCoinBreakdown(actorId);
    let total = 0;
    for (const c of coins) total += (Number(c.count) || 0) * (Number(c.value) || 0);
    return total;
  }

  /**
   * Breaks down currency by denomination. Always returns all denominations.
   * @param {string} actorId
   * @returns {Array<{name:string,count:number,value:number,itemIds:string[]}>} Array of denomination breakdowns
   */
  getCharacterSheetCoinBreakdown(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return [];

    // Get API to avoid circular imports
    const api = game.modules.get('gurps-instant-bazaar')?.api;
    const denoms = api?.system.getCurrencyDenominations() || [];
    const list = readGGAList(actor);
    const carriedEntries = Object.entries(list); // [id, data]

    const out = [];
    for (const d of denoms) {
      const matches = carriedEntries.filter(([_, it]) => it?.name === d.name);
      const count = matches.reduce((s, [_, it]) => s + (Number(it?.count) || 0), 0);
      const ids = matches.map(([id]) => id);
      out.push({ name: d.name, count, value: Number(d.value) || 0, itemIds: ids });
    }
    return out;
  }

  /**
   * Sets the total currency amount. Distributes via makeChange. Preserves placeholder.
   * @param {string} actorId
   * @param {number} newAmount
   * @returns {Promise<boolean>} True if successful
   */
  async setCharacterSheetCurrency(actorId, newAmount) {
    const actor = game.actors.get(actorId);
    if (!actor) return false;

    // Get API to avoid circular imports
    const api = game.modules.get('gurps-instant-bazaar')?.api;
    const denoms = (api?.system.getCurrencyDenominations() || []).slice();
    if (!denoms.length) return false;

    denoms.sort((a, b) => Number(b.value) - Number(a.value));

    const mul = this.baseUnitMultiplier > 0 ? this.baseUnitMultiplier : _calculateBaseUnitMultiplier(denoms);
    const scaled = denoms.map(d => ({ ...d, value: Math.round(Number(d.value) * mul) }));
    const target = Math.max(0, Math.round((Number(newAmount) || 0) * mul));

    try {
      const bag = makeChange(target, scaled); // { [name]: count }
      for (const d of denoms) {
        const cnt = Number(bag[d.name] || 0);
        await upsertCoinGGA(actor, d, cnt);
      }
      this.refreshWalletApplications();
      return true;
    } catch (e) {
      console.error("setCharacterSheetCurrency error:", e);
      return false;
    }
  }

  /**
   * Increments or decrements money and rewrites distribution.
   * @param {Actor} actor
   * @param {number} amount
   * @returns {Promise<void>}
   */
  async addMoneyToCharacterCoins(actor, amount) {
    // Get API to avoid circular imports
    const api = game.modules.get('gurps-instant-bazaar')?.api;
    const denoms = api?.system.getCurrencyDenominations() || [];
    if (!denoms.length) return;

    const list = readGGAList(actor);
    const entries = Object.entries(list); // [id, data]

    const mul = this.baseUnitMultiplier > 0 ? this.baseUnitMultiplier : _calculateBaseUnitMultiplier(denoms);
    const scaled = denoms.map(d => ({ ...d, value: Math.round(Number(d.value) * mul) }))
                         .sort((a, b) => b.value - a.value);

    // current scaled total
    const currentScaled = entries.reduce((sum, [_, it]) => {
      const d = scaled.find(x => x.name === it?.name);
      return d ? sum + (Math.round(Number(it?.count) || 0) * Number(d.value)) : sum;
    }, 0);

    const delta = Math.round((Number(amount) || 0) * mul);
    const nextScaled = Math.max(0, currentScaled + delta);

    const bag = makeChange(nextScaled, scaled); // { [name]: count }

    for (const d of denoms) {
      const cnt = Number(bag[d.name] || 0);
      await upsertCoinGGA(actor, d, cnt);
    }
  }

  /**
   * Ensures placeholder (count=0) for every missing denomination in all player actors.
   * @returns {Promise<void>}
   */
  async initializeMissingActorCoins() {
    // Get API to avoid circular imports
    const api = game.modules.get('gurps-instant-bazaar')?.api;
    const denoms = api?.system.getCurrencyDenominations() || [];
    if (!denoms.length) {
      ui.notifications.warn('No currency denominations configured. Please configure currency denominations first.');
      return;
    }

    for (const actor of game.actors.contents) {
      if (actor.type !== 'character' || !actor.isOwner) continue;

      const list = readGGAList(actor);
      const names = new Set(Object.values(list).map(it => it?.name).filter(Boolean));

      for (const d of denoms) {
        if (!names.has(d.name)) {
          await upsertCoinGGA(actor, d, 0);
        }
      }
    }
    this.refreshWalletApplications();
  }

  /**
   * Refreshes related application windows.
   * @returns {void}
   */
  refreshWalletApplications() {
    for (const app of Object.values(ui.windows)) {
      const k = app?.constructor?.name;
      if (k === 'PlayerWalletApplication' || k === 'VendorDisplayApplication' || k === 'MoneyManagementApplication') {
        app.render(false);
      }
    }
  }
}
