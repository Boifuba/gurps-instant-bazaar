/**
 * @file Transaction manager for handling purchase and sell operations
 * @description Manages all transaction-related operations including purchases, sales, and item transfers
 */

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
    if (game.settings.get(this.moduleId, 'debugMode')) {
      console.log("💰 PLAYER: Sending purchase request to GM...");
      console.log("💰 PLAYER: Emitting socket event...");
    }
    game.socket.emit(this.socketId, {
      type: 'playerPurchaseRequest',
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
    if (game.settings.get(this.moduleId, 'debugMode')) {
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

    // Check wallet
    const currentWallet = this.currencyManager.getUserWallet(game.user.id);
    if (currentWallet < roundedTotalCostRequired) {
      ui.notifications.warn(`Not enough coins! Need ${this.currencyManager.formatCurrency(roundedTotalCostRequired)} but only have ${this.currencyManager.formatCurrency(currentWallet)}.`);
      return;
    }

    // Process each item
    let totalItemsProcessed = 0;
    let totalCostProcessed = 0;

    if (game.settings.get(this.moduleId, 'debugMode')) {
      console.log("💰 GM: Processing selected items...");
    }
    for (const { vendorItem, purchaseQuantity, itemId } of itemsToProcess) {
      if (game.settings.get(this.moduleId, 'debugMode')) {
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

    // Deduct money from wallet
    await this.currencyManager.setUserWallet(game.user.id, currentWallet - totalCostProcessed);

    ui.notifications.info(`Purchased ${totalItemsProcessed} items for ${this.currencyManager.formatCurrency(totalCostProcessed)}!`);
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
    const currentWallet = this.currencyManager.getUserWallet(userId);

    if (currentWallet < totalCost) {
      this.emitPurchaseResult(userId, false, `Not enough coins! Need ${this.currencyManager.formatCurrency(totalCost)} but only have ${this.currencyManager.formatCurrency(currentWallet)}.`);
      return;
    }

    // Handle GM approval if required
    const approved = await this._handleGmPurchaseApproval(userId, validItems, totalCost);
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

      // Deduct money from wallet
      await this.currencyManager.setUserWallet(userId, currentWallet - costProcessed);

      this.emitPurchaseResult(userId, true, `Purchased ${itemsProcessed} items for ${this.currencyManager.formatCurrency(costProcessed)}!`, {
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
   * @param {Array} items - Items to purchase
   * @param {number} totalCost - Total cost of purchase
   * @returns {Promise<boolean>} Whether purchase was approved
   * @private
   */
  async _handleGmPurchaseApproval(userId, items, totalCost) {
    if (!game.settings.get(this.moduleId, 'requireGMApproval')) {
      return true;
    }
    
    const itemList = items
      .map(item => `<li>${item.quantity}x ${item.name} - ${this.currencyManager.formatCurrency(item.price)}</li>`)
      .join('');
    
    return await Dialog.confirm({
      title: 'Approve Purchase',
      content: `<p>${game.users.get(userId)?.name || 'A player'} wants to purchase:</p><ul>${itemList}</ul><p>Total: ${this.currencyManager.formatCurrency(totalCost)}</p>`
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
      type: success ? 'purchaseCompleted' : 'purchaseFailed',
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
    const sellResult = await this._handleGmSellApproval(userId, selectedItems, totalValue);
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
      const useModuleCurrency = game.settings.get(this.moduleId, 'useModuleCurrencySystem');
      let processedFinalPayment = finalPayment;
      
      if (!useModuleCurrency) {
        // Round up to nearest integer when using character sheet currency
        processedFinalPayment = Math.ceil(finalPayment);
        
        // Validate minimum sale value
        if (processedFinalPayment < 1) {
          this.emitSellResult(userId, false, 'Não vale a pena negociar só isso! O valor da venda deve ser pelo menos 1.');
          return;
        }
      }
      
      // Add money to wallet
      const currentWallet = this.currencyManager.getUserWallet(userId);
      await this.currencyManager.setUserWallet(userId, currentWallet + processedFinalPayment);

      const requireGMApproval = game.settings.get(this.moduleId, 'requireGMApproval');
      const saleMessage = requireGMApproval 
        ? `Sold ${itemsProcessed} items for ${this.currencyManager.formatCurrency(processedFinalPayment)} (${sellResult.percentage}% of ${this.currencyManager.formatCurrency(valueProcessed)})!`
        : `Automatically sold ${itemsProcessed} items for ${this.currencyManager.formatCurrency(processedFinalPayment)} (${sellResult.percentage}% of ${this.currencyManager.formatCurrency(valueProcessed)})!`;
      
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
   * @param {Array} selectedItems - Items to sell
   * @param {number} totalValue - Total value of items
   * @returns {Promise<Object>} Object with approved boolean and percentage
   * @private
   */
  async _handleGmSellApproval(userId, selectedItems, totalValue) {
    const requireGMApproval = game.settings.get(this.moduleId, 'requireGMApproval');
    const automaticSellPercentage = game.settings.get(this.moduleId, 'automaticSellPercentage');
    
    if (!requireGMApproval) {
      return { approved: true, percentage: automaticSellPercentage };
    }
    
    const itemList = selectedItems
      .map(item => `<li>${item.quantity}x ${item.name} - ${this.currencyManager.formatCurrency(item.price)}</li>`)
      .join('');
    
    const dialogContent = `
      <div style="padding: 10px;">
        <div style="margin-bottom: 15px; padding: 10px; background: rgba(0, 123, 255, 0.1); border-left: 4px solid #333; border-radius: 4px;">
          <h3 style="margin: 0 0 5px 0; ; font-size: 1.1em;">
            <i class="fas fa-coins" style="margin-right: 8px;"></i>Sale Request
          </h3>
          <p style="margin: 0; font-weight: bold;">${game.users.get(userId)?.name || 'A player'} wants to sell items</p>
        </div>
        
        <div style="margin-bottom: 15px;">
          <h4 style="margin: 0 0 8px 0;  border-bottom: 1px solid #333; padding-bottom: 4px;">
            <i class="fas fa-list" style="margin-right: 6px;"></i>Items to Sell:
          </h4>
          <ul style="margin: 0; padding-left: 20px;  border-radius: 4px; padding: 10px 10px 10px 30px;">${itemList}</ul>
        </div>
        
        <div style="margin-bottom: 20px; padding: 12px; background: rgba(117, 117, 117, 0.1); border: 1px solid #333; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold;  font-size: 1.1em;">
              <i class="fas fa-calculator" style="margin-right: 6px;"></i>Total Value:
            </span>
            <span style="font-size: 1.2em; font-weight: bold; ">${this.currencyManager.formatCurrency(totalValue)}</span>
          </div>
        </div>
        
        <div style="border: 1px solid #333;background: rgba(117, 117, 117, 0.1); border-radius: 8px; padding: 15px;">
          <label for="sellPercentage" style="display: block; margin-bottom: 8px; font-weight: bold;">
            <i class="fas fa-percentage" style="margin-right: 6px; "></i>Sale Percentage:
          </label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="sellPercentageSlider" min="0" max="100" step="1" value="${automaticSellPercentage}" 
                   style="flex: 1; height: 6px;  border-radius: 3px; outline: none;">
            <div style="display: flex; align-items: center; gap: 5px; min-width: 80px;">
              <input type="number" id="sellPercentage" value="${automaticSellPercentage}" min="0" max="100" step="1"
                     style="width: 60px; padding: 4px 8px; border: 1px solid #333; border-radius: 4px; text-align: center; font-weight: bold;">
              <span style="font-weight: bold; ">%</span>
            </div>
          </div>
          <div style="margin-top: 10px; padding: 8px; border-radius: 4px; text-align: center;">
            <span style="font-size: 0.9em;">Final Payment: </span>
            <span id="finalPaymentDisplay" style="font-weight: bold; font-size: 1.1em;">
              ${this.currencyManager.formatCurrency((totalValue * automaticSellPercentage) / 100)}
            </span>
          </div>
        </div>
      </div>
      
      <script>
        (function() {
          const slider = document.getElementById('sellPercentageSlider');
          const input = document.getElementById('sellPercentage');
          const display = document.getElementById('finalPaymentDisplay');
          const totalValue = ${totalValue};
          
          function updatePayment(percentage) {
            const payment = (totalValue * percentage) / 100;
            display.textContent = window.VendorWalletSystem.formatCurrency(payment);
          }
          
          slider.addEventListener('input', function() {
            input.value = this.value;
            updatePayment(this.value);
          });
          
          input.addEventListener('input', function() {
            const value = Math.max(0, Math.min(100, parseInt(this.value) || 0));
            this.value = value;
            slider.value = value;
            updatePayment(value);
          });
        })();
      </script>
    `;
    
    const result = await Dialog.prompt({
      title: 'Approve Sale',
      content: dialogContent,
      callback: (html) => {
        const percentage = parseInt(html.find('#sellPercentage').val()) || 0;
        return { approved: true, percentage };
      },
      rejectClose: false
    });
    
    if (!result || !result.approved) {
      return { approved: false, percentage: 0 };
    }
    
    return { 
      approved: true, 
      percentage: Math.max(0, Math.min(100, result.percentage)) 
    };
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
      const itemPath = window.findItemInCarried(carried, id);
      if (!itemPath) {
        console.warn(`Item ${id} not found in carried equipment for actor ${actor.name}`);
        continue;
      }
      
      const itemData = window.getItemFromPath(carried, itemPath);
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
        // Remove the item completely by setting it to null
        await actor.update({ [`system.equipment.carried.-=${itemPath}`]: null });
      } else {
        // Update the quantity and recalculate costsum and weightsum
        const cost = itemData.cost || 0;
        const weight = itemData.weight || 0;
        await actor.update({ 
          [updatePath]: newQuantity,
          [`system.equipment.carried.${itemPath}.costsum`]: parseFloat((newQuantity * cost).toFixed(1)),
          [`system.equipment.carried.${itemPath}.weightsum`]: parseFloat((newQuantity * weight).toFixed(3))
        });
      }

      itemsProcessed += quantity;
      valueProcessed += price * quantity;
    }
    
    return { itemsProcessed, valueProcessed };
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
      type: success ? 'sellCompleted' : 'sellFailed',
      userId: userId,
      message: message,
      ...data
    });
  }

  /**
   * Adds an item to an actor's inventory with proper quantity handling
   * @param {Actor} actor - The target actor
   * @param {string} uuid - The item UUID
   * @param {number} quantity - The quantity to add
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async addItemToActor(actor, uuid, quantity) {
    if (game.settings.get(this.moduleId, 'debugMode')) {
      console.log(`🔍 DEBUG QUANTITY - Value: ${quantity}, Type: ${typeof quantity}`);
    }
    quantity = Number(quantity);
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    const itemDoc = await fromUuid(uuid);

    if (!itemDoc) {
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
        delete itemData._id;
        const result = await actor.createEmbeddedDocuments("Item", [itemData]);
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
        if (game.settings.get(this.moduleId, 'debugMode')) {
          console.error(`💰 ERROR: Item was not added to character (UUID: ${uuid})`);
        }
        return false;
      }

      // For newly created items, set the quantity directly
      if (game.settings.get(this.moduleId, 'debugMode')) {
        console.log(`🔍 DEBUG NEW ITEM - Setting quantity to: ${quantity}`);
      }
      
      // Wait a tick to ensure the item was fully created
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const eqtUuid = item.system?.eqt?.uuid;
      const key = eqtUuid ? actor._findEqtkeyForId("uuid", eqtUuid) : undefined;

      if (typeof actor.updateEqtCount === "function" && key) {
        if (game.settings.get(this.moduleId, 'debugMode')) {
          console.log(`🔍 DEBUG NEW ITEM - Using updateEqtCount with key: ${key}`);
        }
        await actor.updateEqtCount(key, quantity);
      } else {
        if (game.settings.get(this.moduleId, 'debugMode')) {
          console.log(`🔍 DEBUG NEW ITEM - Using item.update for eqt.count`);
        }
        await item.update({ "system.eqt.count": quantity });
      }
      
      if (game.settings.get(this.moduleId, 'debugMode')) {
        console.log(`🔍 DEBUG NEW ITEM - Final count: ${item.system?.eqt?.count}`);
      }

      return true;
    }
  }
}