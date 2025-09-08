/**
 * @file Character currency CRUD operations
 * @description Centralized service for managing currency items directly on character sheets
 */

import { makeChange, isNonNegInt, _calculateBaseUnitMultiplier } from './currency.js';
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
    count: count,
    weight: denomination.weight || 0,
    cost: denomination.value,
    location: "",
    carried: true,
    equipped: true,
    techlevel: denomination.techlevel || "1",
    categories: denomination.categories || "",
    legalityclass: denomination.legalityclass || "",
    uses: null,
    maxuses: 0,
    parentuuid: "",
    uuid: uuid,
    contains: {},
    originalName: denomination.name,
    originalCount: "",
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
      totalValue += coin.count * coin.value;
    }
    return totalValue;
  }

  /**
   * Gets the breakdown of coins from a character's sheet
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
    const coinBreakdown = [];

    // Get all items from the carried equipment
    const carriedItems = flattenItemsFromObject(carried);
    
    // Find and consolidate coin items that match our denominations
    for (const denomination of denominations) {
      const coinItems = carriedItems.filter(item => 
        item.data.name === denomination.name
      );
      
      if (coinItems.length > 0) {
        // Sum up all quantities for this denomination
        const totalCount = coinItems.reduce((sum, item) => sum + (item.data.count || 0), 0);
        const itemIds = coinItems.map(item => item.id);
        
        if (totalCount > 0) {
          coinBreakdown.push({
            name: denomination.name,
            count: totalCount,
            value: denomination.value,
            itemIds: itemIds
          });
        }
      } else {
        // No items found for this denomination, but we still need to track it
        coinBreakdown.push({
          name: denomination.name,
          count: 0,
          value: denomination.value,
          itemIds: []
        });
      }
    }
    
    return coinBreakdown;
  }

  /**
   * Sets the currency amount on a character's sheet
   * @param {string} userId - The user ID
   * @param {number} newAmount - The new currency amount
   * @returns {Promise<boolean>} True if successful
   */
  async setCharacterSheetCurrency(userId, newAmount) {
    const scaledNewAmount = Math.round((Number(newAmount) || 0) * this.baseUnitMultiplier);

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
      // Calculate the desired coin distribution for the final amount
      const scaledDenominations = denominations.map((denom) => ({
        ...denom,
        value: Math.round(denom.value * this.baseUnitMultiplier)
      }));
      
      const newCoinBag = makeChange(finalScaledAmount, scaledDenominations);
      const updateData = {};

      for (const denomination of denominations) {
        const newCount = newCoinBag[denomination.name] || 0;
        const currentCoinData = currentCoinBreakdown.find((coin) => coin.name === denomination.name);

        if (currentCoinData && currentCoinData.itemIds && currentCoinData.itemIds.length > 0) {
          // Update existing coin item
          if (newCount !== currentCoinData.count) {
            if (newCount === 0) {
              // Remove all items for this denomination if count is 0
              for (const itemId of currentCoinData.itemIds) {
                updateData[`system.equipment.carried.-=${itemId}`] = null;
              }
            } else {
              // Update the first item with the new count and remove the rest
              const firstItemId = currentCoinData.itemIds[0];
              updateData[`system.equipment.carried.${firstItemId}.count`] = newCount;
              
              // Mark all other duplicate items for deletion
              if (currentCoinData.itemIds.length > 1) {
                const duplicateIds = currentCoinData.itemIds.slice(1);
                for (const duplicateId of duplicateIds) {
                  updateData[`system.equipment.carried.-=${duplicateId}`] = null;
                }
              }
            }
          }
        } else if (currentCoinData && currentCoinData.itemIds && currentCoinData.itemIds.length > 0 && newCount === 0) {
          // Remove existing coin items that have zero count in the new distribution
          for (const itemId of currentCoinData.itemIds) {
            updateData[`system.equipment.carried.-=${itemId}`] = null;
          }
        } else if (newCount > 0) {
          // Create new complete coin item
          const newCoinId = foundry.utils.randomID(16);
          const completeCoinData = createCompleteGURPSCoinItem(denomination, newCount);
          updateData[`system.equipment.carried.${newCoinId}`] = completeCoinData;
        }
      }

      // Apply all changes
      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
      }

      if (actor.sheet && actor.sheet.rendered) actor.sheet.render(false);
      this.refreshWalletApplications();
      return true;
    } catch (error) {
      console.error("Error updating character sheet currency:", error);
      return false;
    }
  }

  /**
   * Adds money directly to character sheet coins using optimal distribution
   * @param {Actor} actor - The actor to add money to
   * @param {number} amount - The amount to add
   * @returns {Promise<void>}
   */
  async addMoneyToCharacterCoins(actor, amount) {
    const denominations = game.settings.get(this.moduleId, 'currencyDenominations') || [];
    
    if (denominations.length === 0) {
      console.warn('No currency denominations configured for adding money to character');
      return;
    }

    // Get current coins from character
    const carried = actor.system?.equipment?.carried;
    if (!carried) {
      console.warn(`Actor ${actor.name} has no carried equipment structure`);
      return;
    }

    const carriedItems = flattenItemsFromObject(carried);
    const currentCoins = {};
    const coinItemIds = {};

    // Find and consolidate existing coin items
    for (const denomination of denominations) {
      const coinItems = carriedItems.filter(item => item.data.name === denomination.name);
      if (coinItems.length > 0) {
        // Sum up all quantities for this denomination
        currentCoins[denomination.name] = coinItems.reduce((sum, item) => sum + (item.data.count || 0), 0);
        coinItemIds[denomination.name] = coinItems.map(item => item.id);
      } else {
        currentCoins[denomination.name] = 0;
        coinItemIds[denomination.name] = [];
      }
    }

    // Calculate current total value
    let currentTotalValue = 0;
    for (const [coinName, count] of Object.entries(currentCoins)) {
      const denomination = denominations.find(d => d.name === coinName);
      if (denomination) {
        currentTotalValue += count * denomination.value;
      }
    }

    // Calculate new total and optimal distribution
    const newTotalValue = currentTotalValue + amount;
    const sortedDenominations = [...denominations].sort((a, b) => b.value - a.value);
    
    // Calculate optimal coin distribution for new total
    const newCoinDistribution = {};
    let remainingValue = newTotalValue;
    
    for (const denomination of sortedDenominations) {
      const count = Math.floor(remainingValue / denomination.value);
      newCoinDistribution[denomination.name] = count;
      remainingValue = remainingValue % denomination.value;
    }

    // Update actor with new coin counts
    const updateData = {};
    
    for (const denomination of denominations) {
      const newCount = newCoinDistribution[denomination.name] || 0;
      const currentCount = currentCoins[denomination.name] || 0;
      const itemIds = coinItemIds[denomination.name] || [];

      if (newCount !== currentCount) {
        if (itemIds.length > 0) {
          // Update existing coin item
          if (newCount === 0) {
            // Remove all items for this denomination if count is 0
            for (const itemId of itemIds) {
              updateData[`system.equipment.carried.-=${itemId}`] = null;
            }
          } else {
            // Update the first item with the new count and remove the rest
            const firstItemId = itemIds[0];
            updateData[`system.equipment.carried.${firstItemId}.count`] = newCount;
            
            // Mark all other duplicate items for deletion
            if (itemIds.length > 1) {
              for (let i = 1; i < itemIds.length; i++) {
                updateData[`system.equipment.carried.-=${itemIds[i]}`] = null;
              }
            }
          }
        } else if (newCount > 0) {
          // Create new coin item
          const newCoinId = foundry.utils.randomID(16);
          const completeCoinData = createCompleteGURPSCoinItem(denomination, newCount);
          updateData[`system.equipment.carried.${newCoinId}`] = completeCoinData;
        }
      } else if (newCount === 0 && currentCount === 0 && itemIds.length > 0) {
        // Remove coin items that exist but have zero count in both current and new distribution
        for (const itemId of itemIds) {
          updateData[`system.equipment.carried.-=${itemId}`] = null;
        }
      }
    }

    // Apply all changes
    if (Object.keys(updateData).length > 0) {
      await actor.update(updateData);
      
      // Refresh character sheet if open
      if (actor.sheet && actor.sheet.rendered) {
        actor.sheet.render(false);
      }
    }
  }

  /**
   * Initializes missing currency denominations for all actors without affecting existing coins
   * @returns {Promise<void>}
   */
  async initializeMissingActorCoins() {
    const denominations = game.settings.get(this.moduleId, "currencyDenominations") || [];
    
    if (denominations.length === 0) {
      ui.notifications.warn('No currency denominations configured. Please configure currency settings first.');
      return;
    }

    let processedActors = 0;
    let totalCoinsAdded = 0;

    // Iterate through all actors in the game
    for (const actor of game.actors.contents) {
      // Only process character-type actors that the GM has owner permission for
      if (actor.type !== 'character' || !actor.isOwner) {
        continue;
      }

      const carried = actor.system?.equipment?.carried;
      if (!carried) {
        console.warn(`Actor ${actor.name} has no carried equipment structure`);
        continue;
      }

      // Get all items from the carried equipment to check existing coins
      const carriedItems = flattenItemsFromObject(carried);
      let actorCoinsAdded = 0;
      const updateData = {};

      // Process each denomination for this actor
      for (const denomination of denominations) {
        // Check if the actor already has this coin in carried equipment
        const existingCoin = carriedItems.find(item => item.data.name === denomination.name);

        if (existingCoin) {
          // Skip if coin already exists - don't modify existing coins
          continue;
        } else {
          // Create new complete coin in carried equipment with quantity 0
          const newCoinId = foundry.utils.randomID(16);
          const completeCoinData = createCompleteGURPSCoinItem(denomination, 0);

          updateData[`system.equipment.carried.${newCoinId}`] = completeCoinData;
          actorCoinsAdded++;
        }
      }

      // Apply all coin additions for this actor at once
      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
        processedActors++;
        totalCoinsAdded += actorCoinsAdded;
      }
    }

    // Refresh any open wallet applications
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