/**
 * @file Utility functions for the GURPS Instant Bazaar module
 * @description Common utility functions used across multiple files
 */

import VendorWalletSystem from './main.js';

const SYSTEM_NAME = 'gurps';
const SETTING_USE_FOUNDRY_ITEMS = 'use-foundry-items';

/**
 * Recursively iterates through a list structure with error handling
 * @param {Object} list - The list to iterate through
 * @param {Function} callback - Callback function (element, key, depth)
 * @param {number} depth - Current depth (internal use)
 */
function recurselist(list, callback, depth = 0) {
  if (!list || typeof list !== 'object') return;
  
  for (const [key, element] of Object.entries(list)) {
    if (element && typeof element === 'object') {
      try {
        callback(element, key, depth);
        if (element.collapsed) {
          recurselist(element.collapsed, callback, depth + 1);
        }
      } catch (error) {
        console.warn(`Error processing element ${key} in recurselist:`, error);
        // Continue processing other elements
      }
    }
  }
}

/**
 * Gets all actors owned by a specific user with at least owner permission
 * @param {string} [userId=game.user.id] - The user ID to get actors for
 * @returns {Array<Actor>} Array of actors owned by the user
 */
export function getOwnedPlayerActors(userId = game.user.id) {
  return game.actors.filter(actor => 
    actor.hasPlayerOwner && actor.ownership[userId] >= 3
  );
}

/**
 * Gets the primary actor for a user, handling single/multiple actor scenarios
 * @param {string} [userId=game.user.id] - The user ID to get actor for
 * @returns {Actor|null} The primary actor or null if none found
 */
export function getPrimaryUserActor(userId = game.user.id) {
  const user = game.users.get(userId);
  let actor = user?.character;

  if (!actor) {
    const userActors = getOwnedPlayerActors(userId);
    if (userActors.length > 0) {
      actor = userActors[0];
    }
  }

  return actor;
}

/**
 * Gets processed player actors data with wallet information and coin breakdown
 * @param {string} [currentSelectedActorId] - Currently selected actor ID
 * @returns {Promise<Object>} Object containing processed actors data
 */
export async function getProcessedPlayerActorsData(currentSelectedActorId = null) {
  const useModuleCurrency = VendorWalletSystem.getUseModuleCurrencySystem();
  
  // Get user's actors with Owner permission
  const userActors = getOwnedPlayerActors();
  
  // Process actors with async wallet retrieval
  const processedActors = [];
  for (const actor of userActors) {
    const wallet = await VendorWalletSystem.currencyManager.getActorWallet(actor.id);
    let coinBreakdown = [];
    
    if (!useModuleCurrency) {
      coinBreakdown = VendorWalletSystem.currencyManager.characterCurrencyService?.getCharacterSheetCoinBreakdown(actor.id) || [];
    }
    
    processedActors.push({
      id: actor.id,
      name: actor.name,
      wallet,
      coinBreakdown: Array.isArray(coinBreakdown) ? coinBreakdown : []
    });
  }

  // Initialize selectedActorId if not set
  let selectedActorId = currentSelectedActorId;
  if (!selectedActorId && processedActors.length > 0) {
    selectedActorId = processedActors[0].id;
  }

  // Get selected actor data
  const selectedActor = processedActors.find(actor => actor.id === selectedActorId) || processedActors[0] || {
    id: null,
    name: 'No Character',
    wallet: 0,
    coinBreakdown: []
  };

  return {
    processedActors,
    selectedActor,
    selectedActorId,
    useModuleCurrency
  };
}

/**
 * Safely validates equipment data to prevent undefined name errors
 * @param {Object} item - The item object to validate
 * @returns {boolean} True if item has valid data, false otherwise
 */
export function validateItemData(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  // Ensure name exists and is a string
  if (!item.name || typeof item.name !== 'string') {
    console.warn('Item missing valid name property:', item);
    return false;
  }

  return true;
}

/**
 * Recursively flattens items from GURPS equipment structure with validation
 * @param {Object} obj - The equipment object to flatten
 * @returns {Array} Array of flattened items
 */
export function flattenItemsFromObject(obj) {
  const items = [];
  if (typeof obj !== "object" || obj === null) return items;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === "object" && value !== null) {
        if (value.name !== undefined) {
          // Validate the item before adding it
          if (validateItemData(value)) {
            // This is a valid item
            items.push({ id: key, data: value });
          } else {
            console.warn(`Skipping invalid item ${key}:`, value);
          }
          
          // Check for nested items in collapsed property
          if (value.collapsed && typeof value.collapsed === "object") {
            const nestedItems = flattenItemsFromObject(value.collapsed);
            items.push(...nestedItems);
          }
        } else {
          // This might be a container, recurse into it
          items.push(...flattenItemsFromObject(value));
        }
      }
    }
  }
  return items;
}

/**
 * Recursively finds an item in the carried equipment structure
 * @param {Object} carried - The carried equipment object
 * @param {string} itemId - The item ID to find
 * @param {string} [currentPath=''] - Current path in the structure
 * @returns {string|null} The path to the item or null if not found
 */
export function findItemInCarried(carried, itemId, currentPath = '') {
  if (!carried || typeof carried !== 'object') {
    return null;
  }

  for (const [key, value] of Object.entries(carried)) {
    const path = currentPath ? `${currentPath}.${key}` : key;
    
    if (key === itemId) {
      return path;
    }
    
    if (value && typeof value === 'object' && value.collapsed) {
      const nestedPath = findItemInCarried(value.collapsed, itemId, `${path}.collapsed`);
      if (nestedPath) return nestedPath;
    }
  }
  return null;
}

/**
 * Gets an item from a path in the carried equipment structure with validation
 * @param {Object} carried - The carried equipment object
 * @param {string} path - The path to the item
 * @returns {Object|null} The item data or null if not found
 */
export function getItemFromPath(carried, path) {
  if (!carried || !path) {
    return null;
  }

  const pathParts = path.split('.');
  let current = carried;
  
  for (const part of pathParts) {
    if (current && typeof current === 'object' && current[part] !== undefined) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  // Validate the retrieved item
  if (!validateItemData(current)) {
    console.warn(`Retrieved item from path ${path} is invalid:`, current);
    return null;
  }
  
  return current;
}

/**
 * Removes item elements from actor's system data
 * @param {Actor} actor - The actor to remove from
 * @param {string} itemid - The item ID to remove
 * @param {string} key - The system key to search in
 * @returns {Promise<boolean>} Whether any items were removed
 * @private
 */
async function _removeItemElement(actor, itemid, key) {
  let found = true;
  let any = false;
  if (!key.startsWith('system.'))
    key = 'system.' + key;
  
  while (!!found) {
    found = false;
    let list = foundry.utils.getProperty(actor, key);
    recurselist(list, (e, k, _d) => {
      if (!game.settings.get(SYSTEM_NAME, SETTING_USE_FOUNDRY_ITEMS)) {
        if (e.itemid === itemid)
          found = k;
      } else {
        if (e.fromItem === itemid)
          found = k;
      }
    });
    
    if (!!found) {
      any = true;
      const actorKey = key + '.' + found;
      if (!!game.settings.get(SYSTEM_NAME, SETTING_USE_FOUNDRY_ITEMS)) {
        // We need to remove the child item from the actor
        const childActorComponent = foundry.utils.getProperty(actor, actorKey);
        const existingChildItem = await actor.items.get(childActorComponent.itemid);
        if (!!existingChildItem)
          await existingChildItem.delete();
      }
      await GURPS.removeKey(actor, actorKey);
    }
  }
  return any;
}

/**
 * Removes all item additions from actor
 * @param {Actor} actor - The actor to remove from
 * @param {string} itemid - The item ID to remove
 * @returns {Promise<void>}
 * @private
 */
async function _removeItemAdditions(actor, itemid) {
  await _removeItemElement(actor, itemid, 'melee');
  await _removeItemElement(actor, itemid, 'ranged');
  await _removeItemElement(actor, itemid, 'ads');
  await _removeItemElement(actor, itemid, 'skills');
  await _removeItemElement(actor, itemid, 'spells');
  // await _removeItemEffect(actor, itemid); // Implement if needed
}

/**
 * Deletes a Foundry item with proper cleanup and error handling
 * @param {Actor} actor - The actor to delete from
 * @param {string} itemPath - The item path in the carried equipment structure
 * @returns {Promise<void>}
 */
export async function deleteFoundryItem(actor, itemPath) {
  try {
    // Convert the itemPath to the proper system key format
    const systemKey = `system.equipment.carried.${itemPath}`;
    
    if (!game.settings.get(SYSTEM_NAME, SETTING_USE_FOUNDRY_ITEMS)) {
      if (systemKey.includes('.equipment.')) {
        actor.deleteEquipment(systemKey);
      } else {
        GURPS.removeKey(actor, systemKey);
      }
      if (typeof actor.refreshDR === 'function') {
        await actor.refreshDR();
      }
    } else {
      // Get the item data from the path to find the itemid
      const carried = actor.system?.equipment?.carried;
      const itemData = getItemFromPath(carried, itemPath);
      
      if (!itemData || !itemData.itemid) {
        // Fallback to direct removal if no itemid found
        await GURPS.removeKey(actor, systemKey);
        if (typeof actor.refreshDR === 'function') {
          await actor.refreshDR();
        }
        return;
      }
      
      let item = actor.items.get(itemData.itemid);
      if (!!item) {
        await _removeItemAdditions(actor, item.id);
        await actor.deleteEmbeddedDocuments('Item', [item.id]);
        await GURPS.removeKey(actor, systemKey);
        if (typeof actor.refreshDR === 'function') {
          await actor.refreshDR();
        }
      } else {
        // Fallback to direct removal if item not found
        await GURPS.removeKey(actor, systemKey);
        if (typeof actor.refreshDR === 'function') {
          await actor.refreshDR();
        }
      }
    }
  } catch (error) {
    console.error(`Error deleting Foundry item at path ${itemPath}:`, error);
    // Try fallback removal
    try {
      const systemKey = `system.equipment.carried.${itemPath}`;
      await GURPS.removeKey(actor, systemKey);
      if (typeof actor.refreshDR === 'function') {
        await actor.refreshDR();
      }
    } catch (fallbackError) {
      console.error(`Fallback item removal also failed:`, fallbackError);
      throw fallbackError;
    }
  }
}