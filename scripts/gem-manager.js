/**
 * @file Gem manager for handling gem distribution and calculations
 * @description Manages gem distribution to actors using optimal gem combinations
 */

/**
 * @class GemManager
 * @description Handles gem distribution and management operations
 */
export default class GemManager {
  /**
   * @param {string} moduleId - The module identifier
   */
  constructor(moduleId) {
    this.moduleId = moduleId;
  }

  /**
   * Gets gem variations from game settings
   * @returns {Object} Object containing gemVariations and numberOfGemVariationsToUse
   */
  getGemVariations() {
    const gemVariations = game.settings.get(this.moduleId, 'gemVariations');
    const numberOfGemVariationsToUse = game.settings.get(this.moduleId, 'numberOfGemVariationsToUse');
    return { gemVariations, numberOfGemVariationsToUse };
  }

  /**
   * Generates a specified number of random gems based on configured variations.
   * This method ensures that the generated gems use a limited number of unique types
   * as defined by 'numberOfGemVariationsToUse' setting.
   * @param {number} count - The total number of gems to generate.
   * @returns {Array<Object>} An array of generated gem objects, each with name, value, weight, and quantity.
   */
  generateRandomGems(count) {
    const { gemVariations, numberOfGemVariationsToUse } = this.getGemVariations();

    if (!gemVariations || gemVariations.length === 0) {
      console.warn("No gem variations configured. Please define gem variations in settings.");
      return [];
    }

    // Randomly select 'numberOfGemVariationsToUse' unique gem types
    const shuffledVariations = [...gemVariations].sort(() => 0.5 - Math.random());
    const selectedTypes = shuffledVariations.slice(0, numberOfGemVariationsToUse);

    if (selectedTypes.length === 0) {
      console.warn("No gem types selected based on 'numberOfGemVariationsToUse' setting.");
      return [];
    }

    const generatedGems = [];
    for (let i = 0; i < count; i++) {
      // Pick a random type from the selected types
      const randomType = selectedTypes[Math.floor(Math.random() * selectedTypes.length)];
      
      // For simplicity, each generated gem is quantity 1 for now.
      // This can be expanded later to generate multiple of the same type.
      generatedGems.push({
        name: randomType.name,
        value: randomType.value,
        weight: randomType.weight,
        img: randomType.img,
        quantity: 1 // Each generated item is a single gem
      });
    }
    return generatedGems;
  }

  /**
   * Distributes gems to an actor based on target value using the new gem variations system
   * @param {string} actorId - The actor ID to distribute gems to
   * @param {number} targetValue - The target value to achieve with gems
   * @param {number} [minGemTypes] - Minimum number of different gem types to use
   * @param {number} [maxGemTypes] - Maximum number of different gem types to use
   * @param {number} [totalGemCount] - Total number of gems to distribute (not used currently)
   * @returns {Promise<Object>} Result object with success status and details
   */
  async distributeGemsToActor(actorId, targetValue, minGemTypes = null, maxGemTypes = null, totalGemCount = null) {
    const actor = game.actors.get(actorId);
    if (!actor) {
      return { success: false, message: 'Actor not found' };
    }

    // Import gem calculation functions
    const { gemValues, caratSizes, calculateGemValue, calculateGemWeight, findOptimalGemBag } = await import('./gem-data.js');
    
    // Use EXACTLY the provided minGemTypes and maxGemTypes - NO FALLBACKS
    const typesToUseMin = minGemTypes;
    const typesToUseMax = maxGemTypes;
    
    // Generate optimal gem bag using the algorithm
    const result = findOptimalGemBag(targetValue, gemValues, caratSizes, typesToUseMin, typesToUseMax);
    
    if (result.error) {
      return { success: false, message: result.error };
    }
    
    if (!result.gems || result.gems.length === 0) {
      return { success: false, message: 'Could not generate optimal gem combination' };
    }

    let totalGems = 0;
    let totalWeight = 0;
    let actualValue = 0;

    // Add gems to actor's inventory
    const api = game.modules.get(this.moduleId)?.api;
    if (!api?.system.transactionManager) {
      return { success: false, message: 'Transaction manager not available' };
    }

    for (const gem of result.gems) {
      // Create gem name with carat information
      const gemNameWithCarat = `${gem.name} (${gem.carats} ct)`;
      
      const gemItemData = this.createGemItemData({
        ...gem,
        name: gemNameWithCarat // Use the name with carat info
      });
      
      try {
        // Create the item document
        const tempItem = new Item(gemItemData);
        
        if (!tempItem) {
          console.error(`Failed to create item for gem: ${gem.name}`);
          continue;
        }
      
        // Add the item directly to the actor using GURPS system
        const success = await this.addGemToActorInventory(actor, gemItemData, gem.quantity);
        if (!success) {
          console.warn(`Failed to add ${gem.name} to ${actor.name}`);
        } else {
          totalGems += gem.quantity;
          totalWeight += gem.weight * gem.quantity;
          actualValue += gem.totalValue * gem.quantity;
        }
      } catch (error) {
        console.error(`Error creating gem item for ${gem.name}:`, error);
      }
    }

    const accuracy = actualValue > 0 && targetValue > 0 ? ((actualValue / targetValue) * 100).toFixed(1) : '0.0';

    return {
      success: true,
      actorName: actor.name,
      targetValue: targetValue,
      actualValue: actualValue,
      totalGems: totalGems,
      totalWeight: totalWeight,
      accuracy: accuracy,
      gems: result.gems,
      gemTypes: result.uniqueGemTypes, // Number of unique gem types used
      minGemTypesUsed: result.minGemTypesRequired,
      maxGemTypesAllowed: result.maxGemTypesAllowed
    };
  }

  /**
   * Gets current gems summary for an actor
   * @param {string} actorId - The actor ID
   * @returns {string} Summary of current gems
   */
  getCurrentGemsSummary(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return 'No character found';

    const { gemVariations } = this.getGemVariations();
    const gemNames = new Set(gemVariations.map(gem => gem.name.toLowerCase()));
    
    // Get items from actor's carried equipment
    const carried = actor.system?.equipment?.carried;
    if (!carried) return 'No gems found';

    const api = game.modules.get(this.moduleId)?.api;
    const carriedItems = api?.utils.flattenItemsFromObject(carried) || [];
    
    // Look for gems by checking if the name contains any gem type (accounting for carat info)
    const gems = carriedItems.filter(entry => {
      const itemData = entry.data;
      const itemName = itemData.name.toLowerCase();
      
      // Check if any gem name is contained in the item name
      for (const gemName of gemNames) {
        if (itemName.includes(gemName)) {
          return (itemData.count || 0) > 0;
        }
      }
      return false;
    });

    if (gems.length === 0) return 'No gems found';

    const gemSummary = gems.map(entry => {
      const itemData = entry.data;
      return `${itemData.count}x ${itemData.name}`;
    }).join(', ');

    return gemSummary;
  }

  /**
   * Creates a gem item data object for GURPS
   * @param {Object} gem - The gem object with name, value, weight, img, and quantity
   * @returns {Object} Complete GURPS gem item data
   */
  createGemItemData(gem) {
    return {
      name: gem.name, // This now includes carat info like "Ruby (2.5 ct)"
      type: 'equipment',
      img: gem.img || "icons/commodities/gems/gem-faceted-round-red.webp", // Fallback image
      system: { // GURPS specific system data
        eqt: {
          name: gem.name,
          notes: `A precious ${gem.name.toLowerCase()} gemstone`,
          pageref: "B264",
          count: gem.quantity,
          weight: gem.weight,
          cost: gem.totalValue || gem.value, // Use totalValue if available
          costsum: (gem.totalValue || gem.value) * gem.quantity, // Total value for this stack
          location: "",
          carried: true,
          equipped: false,
          techlevel: 1,
          categories: "Gems",
          legalityclass: "",
          uses: "",
          maxuses: "",
          parentuuid: "",
          uuid: foundry.utils.randomID(16),
          contains: {}
        }
      }
    };
  }

  /**
   * Adds a gem directly to actor's inventory using GURPS system
   * @param {Actor} actor - The target actor
   * @param {Object} gemItemData - The gem item data
   * @param {number} quantity - The quantity to add
   * @returns {Promise<boolean>} True if successful
   */
  async addGemToActorInventory(actor, gemItemData, quantity) {
    try {
      // Import Equipment class from GURPS system
      const { Equipment } = await import("/systems/gurps/module/actor/actor-components.js");
      
      // Create Equipment instance
      const eq = new Equipment(gemItemData.name, true);
      eq.count = quantity;
      eq.cost = gemItemData.system.eqt.cost;
      eq.costsum = gemItemData.system.eqt.cost * quantity; // Ensure costsum is calculated
      eq.weight = gemItemData.system.eqt.weight;
      eq.weightsum = gemItemData.system.eqt.weight * quantity; // Ensure weightsum is calculated
      eq.notes = gemItemData.system.eqt.notes;
      eq.equipped = false;
      eq.carried = true;
      eq.techlevel = 1;
      eq.categories = "Gems";
      eq.legalityclass = "";
      eq.img = gemItemData.img;
      eq.uuid = foundry.utils.randomID(16);
      
      // Add to actor's carried equipment
      const carried = actor.system?.equipment?.carried || {};
      GURPS.put(carried, foundry.utils.duplicate(eq));
      
      // Update actor
      await actor.internalUpdate({ "system.equipment.carried": carried });
      
      // Force recalculation of equipment totals
      if (typeof actor.calculateDerivedValues === 'function') {
        await actor.calculateDerivedValues();
      }
      
      // Refresh actor sheet if rendered
      if (actor.sheet?.rendered) {
        actor.sheet.render(false);
      }
      
      return true;
    } catch (error) {
      console.error(`Error adding gem to actor inventory:`, error);
      return false;
    }
  }
}