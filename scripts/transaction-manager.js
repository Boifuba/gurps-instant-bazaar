/**
 * @file Transaction manager for handling purchase and sell operations
 * @description Manages all transaction-related operations including purchases, sales, and item transfers
 */

import { findItemInCarried, getItemFromPath } from './utils.js';
import { deleteFoundryItem } from './utils.js';
import { SOCKET_EVENTS } from './socket-events.js';
import PurchaseApprovalDialog from './purchase-approval-dialog-app.js';
import SellApprovalDialog from './sell-approval-dialog-app.js';

/**
 * @class TransactionManager
 * @description Handles all transaction operations for the vendor wallet system
 */
export default class TransactionManager {
  /**
   * @param {string} moduleId - The module identifier
   * @param {string} socketId - The socket identifier for communication
   * @param {CurrencyManager} currencyManager - The currency manager instance
   * @param {VendorDataManager} vendorDataManager - The vendor data manager instance
   */
  constructor(moduleId, socketId, currencyManager, vendorDataManager) {
    this.moduleId = moduleId;
    this.socketId = socketId;
    this.currencyManager = currencyManager;
    this.vendorDataManager = vendorDataManager;
  }

  /**
   * Sends a purchase request to the GM via socket (for players)
   * @param {Actor} targetActor - The target actor
   * @param {string} vendorId - The vendor ID
   * @param {Array} selectedItems - Selected items data
   * @param {string} userId - The user ID
   * @returns {Promise<void>}
   */
  async sendPurchaseRequestToGM(targetActor, vendorId, selectedItems, userId) {
    const api = game.modules.get(this.moduleId)?.api;
    if (api?.system.getDebugMode()) {
      console.log("💰 PLAYER: Sending purchase request to GM...");
      console.log("💰 PLAYER: Emitting socket event...");
    }
    game.socket.emit(this.socketId, {
      type: SOCKET_EVENTS.PLAYER_PURCHASE_REQUEST,
      userId: userId,
      actorId: targetActor.id,
      vendorId: vendorId,
      selectedItems: selectedItems
    });
    
    ui.notifications.info('Purchase request sent to GM for processing...');
  }

  /**
   * Processes purchase directly (for GM users)
   * @param {Actor} targetActor - The target actor
   * @param {string} vendorId - The vendor ID
   * @param {Array} selectedItems - Selected items data
   * @returns {Promise<void>}
   */
  async processDirectPurchase(targetActor, vendorId, selectedItems) {
    const api = game.modules.get(this.moduleId)?.api;
    if (api?.system.getDebugMode()) {
      console.log("💰 GM: Processing direct purchase...");
    }
    
    const vendor = this.vendorDataManager.getVendor(vendorId);
    const itemsToProcess = [];
    
    // Validate stock for each item
    for (const selectedItem of selectedItems) {
      const vendorItem = vendor.items.find(item => item.id === selectedItem.id);
      const stock = vendorItem?.quantity;

      if (!vendorItem || (stock !== undefined && selectedItem.quantity > stock)) {
        ui.notifications.warn(`${selectedItem.name || 'Item'} is out of stock.`);
        continue;
      }

      itemsToProcess.push({ vendorItem, purchaseQuantity: selectedItem.quantity, itemId: vendorItem.id });
    }

    if (itemsToProcess.length === 0) return;

    // Calculate total cost
    const totalCostRequired = itemsToProcess.reduce((sum, { vendorItem, purchaseQuantity }) =>
      sum + (vendorItem.price * purchaseQuantity), 0);
    const roundedTotalCostRequired = Math.ceil(totalCostRequired);

    // Check ACTOR's wallet (not user's wallet)
    const currentWallet = await this.currencyManager.getActorWallet(targetActor.id);
    if (currentWallet < roundedTotalCostRequired) {
      ui.notifications.warn(`${targetActor.name} doesn't have enough coins! Needs ${this.currencyManager.formatCurrency(roundedTotalCostRequired)} but only has ${this.currencyManager.formatCurrency(currentWallet)}.`);
      return;
    }

    // Process each item
    let totalItemsProcessed = 0;
    let totalCostProcessed = 0;

    if (api?.system.getDebugMode()) {
      console.log("💰 GM: Processing selected items...");
    }
    for (const { vendorItem, purchaseQuantity, itemId } of itemsToProcess) {
      if (api?.system.getDebugMode()) {
        console.log("💰 GM: Processing vendor item:", vendorItem.name, "Quantity:", purchaseQuantity);
      }
      const success = await this.addItemToActor(targetActor, vendorItem.uuid, purchaseQuantity);
      
      if (!success) {
        ui.notifications.error(`Failed to add ${vendorItem.name} to ${targetActor.name}.`);
        continue;
      }

      totalItemsProcessed += purchaseQuantity;
      totalCostProcessed += vendorItem.price * purchaseQuantity;
      
      // Remove purchased quantity from vendor
      await this.vendorDataManager.updateItemQuantityInVendor(vendorId, vendorItem.id, -purchaseQuantity);
    }

    // Round up the final cost processed
    totalCostProcessed = Math.ceil(totalCostProcessed);

    // Deduct money from ACTOR's wallet (not user's wallet)
    const success = await this.currencyManager.setActorWallet(targetActor.id, currentWallet - totalCostProcessed);
    if (!success) {
      ui.notifications.error(`Failed to deduct money from ${targetActor.name}'s wallet.`);
      return;
    }

    ui.notifications.info(`${targetActor.name} purchased ${totalItemsProcessed} items for ${this.currencyManager.formatCurrency(totalCostProcessed)}!`);
  }

  /**
   * Processes a player's purchase request (GM only)
   * @param {Object} data - Purchase request data containing userId, actorId, vendorId, and selectedItems
   * @returns {Promise<void>}
   */
  async processPlayerPurchaseRequest(data) {
    const { userId, actorId, vendorId, selectedItems } = data;
    const actor = game.actors.get(actorId);
    const vendor = this.vendorDataManager.getVendor(vendorId);
    
    if (!actor || !vendor) {
      if (!actor) {
        this.emitPurchaseResult(userId, false, "Character not found by GM. Please ensure your character exists and has proper permissions.");
      } else {
        this.emitPurchaseResult(userId, false, "Vendor not found by GM. The vendor may have been deleted.");
      }
      return;
    }

    // Validate items and check stock
    const { validItems, invalidItems } = this._validatePurchaseItems(vendor, selectedItems);
    
    // Notify about invalid items
    for (const itemName of invalidItems) {
      this.emitPurchaseResult(userId, false, `${itemName} is out of stock.`);
    }
    
    if (validItems.length === 0) return;

    // Calculate total cost
    const totalCost = this._calculatePurchaseCost(validItems);
    
    // Check ACTOR's wallet (not user's wallet)
    const currentWallet = await this.currencyManager.getActorWallet(actorId);

    if (currentWallet < totalCost) {
      this.emitPurchaseResult(userId, false, `${actor.name} doesn't have enough coins! Needs ${this.currencyManager.formatCurrency(totalCost)} but only has ${this.currencyManager.formatCurrency(currentWallet)}.`);
      return;
    }

    // Handle GM approval if required
    const approved = await this._handleGmPurchaseApproval(userId, actor, validItems, totalCost);
    if (!approved) {
      this.emitPurchaseResult(userId, false, 'Purchase declined by GM.');
      return;
    }

    try {
      const { itemsProcessed, costProcessed } = await this._executePurchaseTransactions(actor, vendorId, validItems);
      
      if (itemsProcessed === 0) {
        this.emitPurchaseResult(userId, false, "No items were purchased.");
        return;
      }

      // Deduct money from ACTOR's wallet (not user's wallet)
      const success = await this.currencyManager.setActorWallet(actorId, currentWallet - costProcessed);
      if (!success) {
        this.emitPurchaseResult(userId, false, `Failed to deduct money from ${actor.name}'s wallet.`);
        return;
      }

      this.emitPurchaseResult(userId, true, `${actor.name} purchased ${itemsProcessed} items for ${this.currencyManager.formatCurrency(costProcessed)}!`, {
        itemCount: itemsProcessed,
        totalCost: costProcessed,
        newWallet: currentWallet - costProcessed
      });

    } catch (error) {
      console.error(error);
      this.emitPurchaseResult(userId, false, `An error occurred while processing the purchase: ${error.message}`);
    }
  }

  /**
   * Validates purchase items and checks stock availability
   * @param {Object} vendor - The vendor object
   * @param {Array} selectedItems - Array of selected items
   * @returns {Object} Object with validItems and invalidItems arrays
   * @private
   */
  _validatePurchaseItems(vendor, selectedItems) {
    const validItems = [];
    const invalidItems = [];
    
    for (const selectedItem of selectedItems) {
      selectedItem.quantity = Number(selectedItem.quantity);
      if (!Number.isFinite(selectedItem.quantity) || selectedItem.quantity < 1) {
        selectedItem.quantity = 1;
      }
      const vendorItem = vendor.items.find(item => item.id === selectedItem.id);
      const stock = vendorItem?.quantity;
      if (!vendorItem || (stock !== undefined && stock < selectedItem.quantity)) {
        invalidItems.push(selectedItem.name);
        continue;
      }
      validItems.push(selectedItem);
    }
    
    return { validItems, invalidItems };
  }

  /**
   * Calculates total cost of items to purchase
   * @param {Array} items - Array of items with price and quantity
   * @returns {number} Total cost
   * @private
   */
  _calculatePurchaseCost(items) {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  /**
   * Handles GM approval for purchase if required
   * @param {string} userId - User ID making the purchase
   * @param {Actor} actor - Actor making the purchase
   * @param {Array} items - Items to purchase
   * @param {number} totalCost - Total cost of purchase
   * @returns {Promise<boolean>} Whether purchase was approved
   * @private
   */
  async _handleGmPurchaseApproval(userId, actor, items, totalCost) {
    const api = game.modules.get(this.moduleId)?.api;
    if (!api?.system.getRequireGMApproval()) {
      return true;
    }
    
    const userName = game.users.get(userId)?.name || 'A player';

    return new Promise((resolve, reject) => {
      new api.applications.PurchaseApprovalDialog({
        actorName: actor.name,
        userName: userName,
        items: items,
        totalCost: totalCost,
        resolve: resolve,
        reject: reject
      }).render(true);
    });
  }

  /**
   * Executes purchase transactions for validated items
   * @param {Actor} actor - Target actor
   * @param {string} vendorId - Vendor ID
   * @param {Array} items - Items to purchase
   * @returns {Promise<Object>} Object with itemsProcessed and costProcessed
   * @private
   */
  async _executePurchaseTransactions(actor, vendorId, items) {
    let itemsProcessed = 0;
    let costProcessed = 0;

    for (const selectedItem of items) {
      const { uuid, quantity, id, price, name } = selectedItem;
      const success = await this.addItemToActor(actor, uuid, quantity);
      
      if (!success) {
        console.error(`Failed to add ${name} to ${actor.name}.`);
        continue;
      }

      itemsProcessed += quantity;
      costProcessed += price * quantity;

      // Remove purchased quantity from vendor
      await this.vendorDataManager.updateItemQuantityInVendor(vendorId, id, -quantity);
    }

    // Apply proper rounding to 1 decimal place
    costProcessed = Math.round(costProcessed * 10) / 10;
    
    return { itemsProcessed, costProcessed };
  }

  /**
   * Emits a purchase result to the specified user
   * @param {string} userId - The user ID to send the result to
   * @param {boolean} success - Whether the purchase was successful
   * @param {string} message - The message to display
   * @param {Object} data - Additional data to include
   */
  emitPurchaseResult(userId, success, message, data = {}) {
    game.socket.emit(this.socketId, {
      type: success ? SOCKET_EVENTS.PURCHASE_COMPLETED : SOCKET_EVENTS.PURCHASE_FAILED,
      userId: userId,
      message: message,
      ...data
    });
  }

  /**
   * Processes a player's sell request (GM only)
   * @param {Object} data - Sell request data containing userId, actorId, and selectedItems
   * @returns {Promise<void>}
   */
  async processPlayerSellRequest(data) {
    const { userId, actorId, selectedItems } = data;
    const actor = game.actors.get(actorId);
    
    if (!actor) {
      this.emitSellResult(userId, false, "Character not found by GM. Please ensure your character exists and has proper permissions.");
      return;
    }

    // Calculate total value
    const totalValue = this._calculateSellValue(selectedItems);
    
    // Handle GM approval and get sell percentage
    const sellResult = await this._handleGmSellApproval(userId, actorId, selectedItems, totalValue);
    if (!sellResult.approved) {
      this.emitSellResult(userId, false, 'Sale declined by GM.');
      return;
    }

    try {
      const { itemsProcessed, valueProcessed } = await this._updateActorInventoryForSell(actor, selectedItems, userId);
      
      if (itemsProcessed === 0) {
        this.emitSellResult(userId, false, "No items were sold.");
        return;
      }

      // Calculate final payment
      const finalPayment = (valueProcessed * sellResult.percentage) / 100;
      
      // Check if module currency system is disabled
      const api = game.modules.get(this.moduleId)?.api;
      const useModuleCurrency = api?.system.getUseModuleCurrencySystem();
      let processedFinalPayment = finalPayment;
      
      if (!useModuleCurrency) {
        // Round up to nearest integer when using character sheet currency
        processedFinalPayment = Math.ceil(finalPayment);
        
        // Validate minimum sale value
        if (processedFinalPayment < 1) {
          this.emitSellResult(userId, false, 'It\'s not worth trading just that! The sale value must be at least 1.');
          return;
        }
        
        // Add money directly to character sheet coins instead of wallet
        await this._addMoneyToCharacterCoins(actor, processedFinalPayment);
      } else {
        // Add money to ACTOR's wallet for module currency system (not user's wallet)
        const currentWallet = await this.currencyManager.getActorWallet(actorId);
        const success = await this.currencyManager.setActorWallet(actorId, currentWallet + processedFinalPayment);
        if (!success) {
          this.emitSellResult(userId, false, `Failed to add money to ${actor.name}'s wallet.`);
          return;
        }
      }

      const requireGMApproval = api?.system.getRequireGMApproval();
      const saleMessage = requireGMApproval 
        ? `${actor.name} sold ${itemsProcessed} items for ${this.currencyManager.formatCurrency(processedFinalPayment)} (${sellResult.percentage}% of ${this.currencyManager.formatCurrency(valueProcessed)})!`
        : `${actor.name} automatically sold ${itemsProcessed} items for ${this.currencyManager.formatCurrency(processedFinalPayment)} (${sellResult.percentage}% of ${this.currencyManager.formatCurrency(valueProcessed)})!`;
      
      this.emitSellResult(userId, true, saleMessage);

    } catch (error) {
      console.error(error);
      this.emitSellResult(userId, false, `An error occurred while processing the sale: ${error.message}`);
    }
  }

  /**
   * Calculates total value of items to sell
   * @param {Array} selectedItems - Items to sell
   * @returns {number} Total value
   * @private
   */
  _calculateSellValue(selectedItems) {
    return selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  /**
   * Handles GM approval for sell request
   * @param {string} userId - User ID making the sell request
   * @param {string} actorId - Actor ID making the sell request
   * @param {Array} selectedItems - Items to sell
   * @param {number} totalValue - Total value of items
   * @returns {Promise<Object>} Object with approved boolean and percentage
   * @private
   */
  async _handleGmSellApproval(userId, actorId, selectedItems, totalValue) {
    const api = game.modules.get(this.moduleId)?.api;
    const requireGMApproval = api?.system.getRequireGMApproval();
    const automaticSellPercentage = api?.system.getAutomaticSellPercentage();
    
    if (!requireGMApproval) {
      return { approved: true, percentage: automaticSellPercentage };
    }
    
    const userName = game.users.get(userId)?.name || 'A player';
    const actorName = game.actors.get(actorId)?.name || 'Character';

    return new Promise((resolve, reject) => {
      new api.applications.SellApprovalDialog({
        actorName: actorName,
        userName: userName,
        items: selectedItems,
        totalValue: totalValue,
        automaticSellPercentage: automaticSellPercentage,
        resolve: resolve,
        reject: reject
      }).render(true);
    });
  }

  /**
   * Updates actor inventory by removing sold items
   * @param {Actor} actor - The actor to update
   * @param {Array} selectedItems - Items to remove
   * @param {string} userId - User ID for error reporting
   * @returns {Promise<Object>} Object with itemsProcessed and valueProcessed
   * @private
   */
  async _updateActorInventoryForSell(actor, selectedItems, userId) {
    let itemsProcessed = 0;
    let valueProcessed = 0;

    for (const selectedItem of selectedItems) {
      const { id, quantity, price, uuid } = selectedItem;
      
      // For GURPS equipment items, we need to update the carried equipment directly
      const carried = actor.system?.equipment?.carried;
      if (!carried) {
        console.warn(`No carried equipment found for actor ${actor.name}`);
        continue;
      }
      
      // Find the item in the carried equipment structure
      const itemPath = findItemInCarried(carried, id);
      if (!itemPath) {
        console.warn(`Item ${id} not found in carried equipment for actor ${actor.name}`);
        continue;
      }
      
      const itemData = getItemFromPath(carried, itemPath);
      if (!itemData) {
        console.warn(`Could not retrieve item data for ${id}`);
        continue;
      }
      
      const currentQuantity = itemData.count || 1;
      
      if (currentQuantity < quantity) {
        this.emitSellResult(userId, false, `Not enough ${itemData.name} to sell (have ${currentQuantity}, trying to sell ${quantity}).`);
        continue;
      }

      // Update the item quantity in the carried equipment
      const newQuantity = currentQuantity - quantity;
      const updatePath = `system.equipment.carried.${itemPath}.count`;
      
      if (newQuantity <= 0) {
        // Use the specialized delete function
        await deleteFoundryItem(actor, itemPath);
      } else {
        // Update the quantity and recalculate costsum and weightsum
        await actor.update({ 
          [updatePath]: newQuantity
        });
      }

      itemsProcessed += quantity;
      valueProcessed += price * quantity;
    }
    
    return { itemsProcessed, valueProcessed };
  }

  /**
   * Adds money directly to character sheet coins using optimal distribution
   * @param {Actor} actor - The actor to add money to
   * @param {number} amount - The amount to add
   * @returns {Promise<void>}
   * @private
   */
  async _addMoneyToCharacterCoins(actor, amount) {
    // Delegate to the character currency service through currency manager
    if (this.currencyManager.characterCurrencyService) {
      await this.currencyManager.characterCurrencyService.addMoneyToCharacterCoins(actor, amount);
    } else {
      console.error('Character currency service not available');
      throw new Error('Character currency service not initialized');
    }
  }

  /**
   * Emits a sell result to the specified user
   * @param {string} userId - The user ID to send the result to
   * @param {boolean} success - Whether the sell was successful
   * @param {string} message - The message to display
   * @param {Object} data - Additional data to include
   */
  emitSellResult(userId, success, message, data = {}) {
    game.socket.emit(this.socketId, {
      type: success ? SOCKET_EVENTS.SELL_COMPLETED : SOCKET_EVENTS.SELL_FAILED,
      userId: userId,
      message: message,
      ...data
    });
  }

  /**
   * Validates item data before adding to actor
   * @param {Object} itemDoc - The item document
   * @returns {boolean} True if item is valid, false otherwise
   * @private
   */
  _validateItemData(itemDoc) {
    if (!itemDoc) {
      console.warn('Item document is null or undefined');
      return false;
    }

    // Ensure the item has a name property
    const itemData = itemDoc.toObject ? itemDoc.toObject() : { ...itemDoc };
    if (!itemData.name || typeof itemData.name !== 'string') {
      console.warn('Item missing valid name property:', itemData);
      return false;
    }

    // Ensure required system properties are present
    if (!itemData.system) {
      console.warn('Item missing system data:', itemData);
      return false;
    }

    return true;
  }

  /**
   * Sanitizes item data to prevent undefined properties
   * @param {Object} itemData - The item data to sanitize
   * @returns {Object} Sanitized item data
   * @private
   */
  _sanitizeItemData(itemData) {
    const sanitized = { ...itemData };

    // Ensure name is always a string
    if (!sanitized.name || typeof sanitized.name !== 'string') {
      sanitized.name = 'Unnamed Item';
    }

    // Ensure system data exists
    if (!sanitized.system) {
      sanitized.system = {};
    }

    // Ensure eqt data exists with default values
    if (!sanitized.system.eqt) {
      sanitized.system.eqt = {
        count: 1,
        equipped: false
      };
    }

    return sanitized;
  }

  /**
   * Adds an item to an actor's inventory with proper quantity handling
   * @param {Actor} actor - The target actor
   * @param {string} uuid - The item UUID
   * @param {number} quantity - The quantity to add
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async addItemToActor(actor, uuid, quantity) {
    const api = game.modules.get(this.moduleId)?.api;
    if (api?.system.getDebugMode()) {
      console.log(`🔍 DEBUG QUANTITY - Value: ${quantity}, Type: ${typeof quantity}`);
    }
    quantity = Number(quantity);
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    
    try {
      const itemDoc = await fromUuid(uuid);

      // Validate item data before proceeding
      if (!this._validateItemData(itemDoc)) {
        console.error(`Invalid item data for UUID: ${uuid}`);
        return false;
      }

      let item = actor.items.find(i =>
        i._stats?.compendiumSource === uuid ||
        i.flags?.core?.sourceId === uuid ||
        i.system.globalid === uuid
      );

      if (item) {
        // For existing items, add the new quantity to the current one
        const current = item.system?.eqt?.count ?? 0;
        const total = current + quantity;

        const eqtUuid = item.system?.eqt?.uuid;
        const key = eqtUuid ? actor._findEqtkeyForId("uuid", eqtUuid) : undefined;

        if (typeof actor.updateEqtCount === "function" && key) {
          await actor.updateEqtCount(key, total);
        } else {
          await item.update({ "system.eqt.count": total });
        }

        return true;
      } else {
        let createdItem;

        if (typeof actor.handleItemDrop === "function") {
          const dropData = { type: "Item", uuid };
          // Support both modern and legacy signatures for handleItemDrop
          if (actor.handleItemDrop.length >= 2) {
            createdItem = await actor.handleItemDrop(null, dropData);
          } else {
            createdItem = await actor.handleItemDrop(dropData);
          }
        } else if (typeof actor.createEmbeddedDocuments === "function") {
          const itemData = itemDoc.toObject ? itemDoc.toObject() : { ...itemDoc };
          // Sanitize the item data to prevent undefined properties
          const sanitizedData = this._sanitizeItemData(itemData);
          delete sanitizedData._id;
          
          const result = await actor.createEmbeddedDocuments("Item", [sanitizedData]);
          createdItem = Array.isArray(result) ? result[0] : result;
        }

        if (createdItem instanceof Item) {
          item = createdItem;
        } else if (Array.isArray(createdItem) && createdItem[0] instanceof Item) {
          item = createdItem[0];
        }

        if (!item) {
          item = actor.items.find(i =>
            i._stats?.compendiumSource === uuid ||
            i.flags?.core?.sourceId === uuid ||
            i.system?.globalid === uuid
          );
        }

        if (!(item instanceof Item)) {
          if (api?.system.getDebugMode()) {
            console.error(`💰 ERROR: Item was not added to character (UUID: ${uuid})`);
          }
          return false;
        }

        // For newly created items, set the quantity directly
        if (api?.system.getDebugMode()) {
          console.log(`🔍 DEBUG NEW ITEM - Setting quantity to: ${quantity}`);
        }
        
        /**
         * WORKAROUND: Wait a tick to ensure the item was fully created and processed.
         * This is necessary due to the asynchronous nature of FoundryVTT's item creation APIs.
         * The item needs to be fully integrated into the actor's data structure before we can
         * reliably update its quantity. Without this delay, quantity updates may fail silently
         * or be overwritten by the item creation process.
         */
        await new Promise(resolve => setTimeout(resolve, 50)); // Increased delay for better reliability
        
        const eqtUuid = item.system?.eqt?.uuid;
        const key = eqtUuid ? actor._findEqtkeyForId("uuid", eqtUuid) : undefined;

        if (typeof actor.updateEqtCount === "function" && key) {
          if (api?.system.getDebugMode()) {
            console.log(`🔍 DEBUG NEW ITEM - Using updateEqtCount with key: ${key}`);
          }
          await actor.updateEqtCount(key, quantity);
        } else {
          if (api?.system.getDebugMode()) {
            console.log(`🔍 DEBUG NEW ITEM - Using item.update for eqt.count`);
          }
          await item.update({ "system.eqt.count": quantity });
        }
        
        if (api?.system.getDebugMode()) {
          console.log(`🔍 DEBUG NEW ITEM - Final count: ${item.system?.eqt?.count}`);
        }

        return true;
      }
    } catch (error) {
      console.error(`Error adding item to actor: ${error.message}`, error);
      return false;
    }
  }
}