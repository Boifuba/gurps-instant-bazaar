/**
 * @file Character currency CRUD operations
 * @description Centralized service for managing currency items directly on character sheets
 */

import { makeChange, _calculateBaseUnitMultiplier } from './currency.js';
import { flattenItemsFromObject } from './utils.js';

/**
 * Creates a complete GURPS currency item with all required properties
 * @param {Object} denomination - The currency denomination configuration
 * @param {number} count - The initial count for this currency
 * @returns {Object} Complete GURPS currency item object
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
    weight: denomination.weight || 0,
    cost: denomination.value,
    location: "",
    carried: true,
    equipped: false,                  // moedas não “equipadas”
    techlevel: denomination.techlevel ?? 1,
    categories: denomination.categories || "",
    legalityclass: denomination.legalityclass || "",
    uses: null,
    maxuses: 0,
    parentuuid: "",
    uuid,
    contains: {},
    originalName: denomination.name,
    originalCount: 0,                 // número, não string
    ignoreImportQty: false,
    last_import: currentDate,
    save: true,
    itemid: itemId,
    img: denomination.img || "icons/svg/item-bag.svg"
  };
}

/**
 * Service class for managing currency items on character sheets
 */
export default class CharacterCurrencyService {
  /**
   * @param {string} moduleId - The module identifier
   * @param {number} baseUnitMultiplier - The base unit multiplier for currency calculations
   */
  constructor(moduleId, baseUnitMultiplier) {
    this.moduleId = moduleId;
    this.baseUnitMultiplier = baseUnitMultiplier;
  }

  /**
   * Gets the total currency value from a character's sheet
   * @param {string} userId - The user ID
   * @returns {number} Total currency value
   */
  getCharacterSheetCurrency(userId) {
    const coinBreakdown = this.getCharacterSheetCoinBreakdown(userId);
    let totalValue = 0;
    for (const coin of coinBreakdown) {
      totalValue += (Number(coin.count) || 0) * (Number(coin.value) || 0);
    }
    return totalValue;
  }

  /**
   * Gets the breakdown of coins from a character's sheet
   * Always returns entries for all denominations and preserves itemIds even when count=0
   * @param {string} userId - The user ID
   * @returns {Array} Array of coin breakdown objects
   */
  getCharacterSheetCoinBreakdown(userId) {
    const user = game.users.get(userId);
    let actor = user?.character;

    if (!actor) {
      const userActors = game.actors.filter(
        (a) => a.hasPlayerOwner && a.ownership[userId] >= 3
      );
      if (userActors.length > 0) actor = userActors[0];
    }
    if (!actor) return [];

    const carried = actor.system?.equipment?.carried;
    if (!carried) return [];

    const denominations = game.settings.get(this.moduleId, "currencyDenominations") || [];
    const carriedItems = flattenItemsFromObject(carried);

    const coinBreakdown = [];
    for (const denomination of denominations) {
      const coinItems = carriedItems.filter(item => item.data.name === denomination.name);
      const totalCount = coinItems.reduce((sum, item) => sum + (Number(item.data.count) || 0), 0);
      const itemIds = coinItems.map(item => item.id);

      coinBreakdown.push({
        name: denomination.name,
        count: totalCount,                 // pode ser 0
        value: denomination.value,
        itemIds                             // pode ter ids mesmo com count 0
      });
    }

    return coinBreakdown;
  }

  /**
   * Sets the currency amount on a character's sheet
   * Keeps one placeholder item with count=0 instead of deleting all
   * @param {string} userId - The user ID
   * @param {number} newAmount - The new currency amount
   * @returns {Promise<boolean>} True if successful
   */
  async setCharacterSheetCurrency(userId, newAmount) {
    const scaledNewAmount = Math.round((Number(newAmount) || 0) * (Number(this.baseUnitMultiplier) || 1));

    const user = game.users.get(userId);
    if (!user) return false;

    let actor = user.character;
    if (!actor) {
      const userActors = game.actors.filter(
        (a) => a.hasPlayerOwner && a.ownership[userId] >= 3
      );
      if (userActors.length > 0) actor = userActors[0];
    }
    if (!actor) return false;

    const currentCoinBreakdown = this.getCharacterSheetCoinBreakdown(userId);

    const denominations = (game.settings.get(this.moduleId, "currencyDenominations") || [])
      .slice()
      .sort((a, b) => b.value - a.value);
    if (denominations.length === 0) return false;

    const finalScaledAmount = Math.max(0, scaledNewAmount);

    try {
      const mul = Number(this.baseUnitMultiplier) > 0
        ? this.baseUnitMultiplier
        : _calculateBaseUnitMultiplier(denominations);

      const scaledDenominations = denominations.map((denom) => ({
        ...denom,
        value: Math.round(Number(denom.value) * mul)
      }));

      const newCoinBag = makeChange(finalScaledAmount, scaledDenominations); // { [name]: count }
      const updateData = {};

      for (const denomination of denominations) {
        const newCount = Number(newCoinBag[denomination.name] || 0);
        const currentCoinData = currentCoinBreakdown.find((coin) => coin.name === denomination.name);
        const ids = currentCoinData?.itemIds || [];

        if (ids.length > 0) {
          // Atualiza o primeiro item. Remove duplicatas. Mantém placeholder quando newCount=0.
          const firstId = ids[0];
          updateData[`system.equipment.carried.${firstId}.count`] = newCount;
          for (const dupId of ids.slice(1)) {
            updateData[`system.equipment.carried.-=${dupId}`] = null;
          }
        } else if (newCount > 0) {
          // Não existe item para essa denominação. Criar um.
          const newCoinId = foundry.utils.randomID(16);
          const completeCoinData = createCompleteGURPSCoinItem(denomination, newCount);
          updateData[`system.equipment.carried.${newCoinId}`] = completeCoinData;
        } // else: newCount === 0 e não há item -> não cria nada
      }

      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
      }

      if (actor.sheet?.rendered) actor.sheet.render(false);
      this.refreshWalletApplications();
      return true;
    } catch (error) {
      console.error("Error updating character sheet currency:", error);
      return false;
    }
  }

  /**
   * Adds money directly to character sheet coins using optimal distribution
   * Reuses placeholders with count=0 and uses integer scaling.
   * @param {Actor} actor - The actor to add money to
   * @param {number} amount - The amount to add (can be negative; result is clamped to >= 0)
   * @returns {Promise<void>}
   */
  async addMoneyToCharacterCoins(actor, amount) {
    const denominations = game.settings.get(this.moduleId, 'currencyDenominations') || [];
    if (!denominations.length) {
      console.warn('No currency denominations configured for adding money to character');
      return;
    }

    const carried = actor.system?.equipment?.carried;
    if (!carried) {
      console.warn(`Actor ${actor.name} has no carried equipment structure`);
      return;
    }

    const items = flattenItemsFromObject(carried);
    const currentCoins = {};
    const coinItemIds = {};

    // Consolidar itens existentes
    for (const d of denominations) {
      const coinItems = items.filter(it => it.data.name === d.name);
      currentCoins[d.name] = coinItems.reduce((s, it) => s + (Number(it.data.count) || 0), 0);
      coinItemIds[d.name] = coinItems.map(it => it.id);
    }

    // Escala inteira
    const mul = Number(this.baseUnitMultiplier) > 0
      ? this.baseUnitMultiplier
      : _calculateBaseUnitMultiplier(denominations);

    const scaledDenoms = denominations
      .map(d => ({ ...d, value: Math.round(Number(d.value) * mul) }))
      .sort((a, b) => b.value - a.value);

    const currentScaledTotal = Object.entries(currentCoins).reduce((sum, [name, cnt]) => {
      const d = scaledDenoms.find(x => x.name === name);
      return d ? sum + (Number(cnt) * Number(d.value)) : sum;
    }, 0);

    const delta = Math.round((Number(amount) || 0) * mul);
    const newScaledTotal = Math.max(0, currentScaledTotal + delta);

    // Distribuição ótima
    const bag = makeChange(newScaledTotal, scaledDenoms); // { [name]: count }

    // Aplicar mudanças, preservando placeholder
    const updateData = {};

    for (const d of denominations) {
      const newCount = Number(bag[d.name] || 0);
      const ids = coinItemIds[d.name] || [];

      if (!ids.length) {
        if (newCount > 0) {
          const id = foundry.utils.randomID(16);
          const data = createCompleteGURPSCoinItem(d, newCount);
          updateData[`system.equipment.carried.${id}`] = data;
        }
        // se newCount === 0 e não há item, não cria nada
        continue;
      }

      // Há itens existentes. Atualiza o primeiro e remove duplicatas extras.
      const firstId = ids[0];
      updateData[`system.equipment.carried.${firstId}.count`] = newCount;

      for (let i = 1; i < ids.length; i++) {
        updateData[`system.equipment.carried.-=${ids[i]}`] = null;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await actor.update(updateData);
      if (actor.sheet?.rendered) actor.sheet.render(false);
    }
  }

  /**
   * Initializes missing currency denominations for all actors without affecting existing coins
   * Ensures each actor has a placeholder item (count=0) for every denomination.
   * @returns {Promise<void>}
   */
  async initializeMissingActorCoins() {
    const denominations = game.settings.get(this.moduleId, "currencyDenominations") || [];
    if (!denominations.length) {
      ui.notifications.warn('No currency denominations configured. Please configure currency settings first.');
      return;
    }

    let processedActors = 0;
    let totalCoinsAdded = 0;

    for (const actor of game.actors.contents) {
      if (actor.type !== 'character' || !actor.isOwner) continue;

      const carried = actor.system?.equipment?.carried;
      if (!carried) {
        console.warn(`Actor ${actor.name} has no carried equipment structure`);
        continue;
      }

      const carriedItems = flattenItemsFromObject(carried);
      let actorCoinsAdded = 0;
      const updateData = {};

      for (const denomination of denominations) {
        const existingCoins = carriedItems.filter(it => it.data.name === denomination.name);
        if (existingCoins.length > 0) continue;

        const newCoinId = foundry.utils.randomID(16);
        const completeCoinData = createCompleteGURPSCoinItem(denomination, 0);
        updateData[`system.equipment.carried.${newCoinId}`] = completeCoinData;
        actorCoinsAdded++;
      }

      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
        processedActors++;
        totalCoinsAdded += actorCoinsAdded;
      }
    }

    this.refreshWalletApplications();
    console.log(`Initialized missing coins for ${processedActors} actors, added ${totalCoinsAdded} new coin items total.`);
  }

  /**
   * Refreshes any open wallet-related applications
   * @returns {void}
   */
  refreshWalletApplications() {
    Object.values(ui.windows).forEach((app) => {
      if (
        app.constructor.name === 'PlayerWalletApplication' ||
        app.constructor.name === 'VendorDisplayApplication' ||
        app.constructor.name === 'MoneyManagementApplication'
      ) {
        app.render(false);
      }
    });
  }
}
