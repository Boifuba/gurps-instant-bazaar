/**
 * @file Main module file for the Vendor Wallet System
 * @description Provides core functionality for managing vendors, player wallets, and item transactions in FoundryVTT
 */

console.log("🐮 VENDOR WALLET SYSTEM: main.js loaded!");

/**
 * @class VendorWalletSystem
 * @description Core class that manages the vendor and wallet system functionality
 */
class VendorWalletSystem {
  /** @type {string} Module identifier */
  static ID = 'gurps-instant-bazaar';
  
  /** @type {string} Socket identifier for module communication */
  static SOCKET = `module.${VendorWalletSystem.ID}`;

  /** @type {CurrencyManager} Currency manager instance */
  static currencyManager = null;

  /**
   * Initializes the module by registering settings, socket listeners, and handlebars helpers
   * @returns {void}
   */
  static initialize() {
    this.registerSettings();
    this.registerSocketListeners();
    
    // Initialize currency manager
    this.currencyManager = new window.CurrencyManager(this.ID);
    
    if (typeof Handlebars !== 'undefined') {
      Handlebars.registerHelper('formatCurrency', this.currencyManager.formatCurrency.bind(this.currencyManager));
      Handlebars.registerHelper('join', (arr, sep) => Array.isArray(arr) ? arr.join(sep) : '');
    }
  }

  /**
   * Formats a numeric amount as currency string
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string
   */
  static formatCurrency(amount) {
    return this.currencyManager.formatCurrency(amount);
  }

  /**
   * Parses a currency-formatted string into a numeric value
   * @param {string|number} value - The currency string or number
   * @returns {number} Parsed numeric value
   */
  static parseCurrency(value) {
    return this.currencyManager.parseCurrency(value);
  }

  /**
   * Registers module settings with FoundryVTT
   * @returns {void}
   */
  static registerSettings() {
    game.settings.register(this.ID, 'vendors', {
      name: 'Vendors Data',
      scope: 'world',
      config: false,
      type: Object,
      default: {}
    });
    game.settings.register(this.ID, 'useModuleCurrencySystem', {
      name: 'Use Module Currency System',
      hint: 'The module will manage all money, regardless of what\'s on the player\'s character sheet.',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    });
    game.settings.register(this.ID, 'currencyName', {
      name: 'Main Currency Name',
      hint: 'Name for the main currency (e.g., dollars, credits, coins).',
      scope: 'world',
      config: true,
      type: String,
      default: 'coins'
    });
    game.settings.register(this.ID, 'currencyDenominations', {
      name: 'Currency Denominations',
      scope: 'world',
      config: false,
      type: Array,
      default: [
        { name: "Gold Coin", value: 80 },
        { name: "Silver Coin", value: 4 },
        { name: "Copper Farthing", value: 1 }
      ]
    });
    game.settings.register(this.ID, 'optimizeOnConstruct', {
      name: 'Optimize On Construct',
      hint: 'When enabled, wallets will automatically convert coins to the optimal combination (minimal number of coins).',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    });
    game.settings.register(this.ID, 'requireGMApproval', {
      name: 'Require GM Approval for Sales',
      hint: 'If enabled, the GM must approve player sale requests.',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    });
    game.settings.register(this.ID, 'automaticSellPercentage', {
      name: 'Automatic Sell Percentage',
      hint: 'Percentage of item value when selling automatically (when GM approval is disabled).',
      scope: 'world',
      config: true,
      type: Number,
      default: 50,
      range: {
        min: 0,
        max: 100,
        step: 1
      }
    });
  }

  /**
   * Registers socket event listeners for real-time communication
   * @returns {void}
   */
  static registerSocketListeners() {
    game.socket.on(this.SOCKET, this.handleSocketEvent.bind(this));
  }

  /**
   * Adds a wallet button to the player list interface
   * @param {Application} app - The FoundryVTT application
   * @param {jQuery} html - The HTML element
   * @returns {void}
   */
  static addPlayerWalletButton(app, html) {
    const button = $(`<button class="wallet-button"><i class="fas fa-wallet"></i> Wallet</button>`);
    button.on('click', () => new PlayerWalletApplication().render(true));
    html.find('.player-list').before(button);
  }

  /**
   * Gets the wallet amount for a specific user
   * @param {string} userId - The user ID
   * @returns {number} The wallet amount
   */
  static getUserWallet(userId) {
    return this.currencyManager.getUserWallet(userId);
  }

  /**
   * Gets the breakdown of currency coins from module wallet system
   * @param {string} userId - The user ID
   * @returns {Array<{name: string, count: number, value: number}>} Array of coin breakdown objects
   */
  static getModuleCurrencyBreakdown(userId) {
    const denominations = game.settings.get(this.ID, 'currencyDenominations') || [];
    return this.currencyManager.getModuleCurrencyBreakdown(userId, denominations);
  }

  /**
   * Sets the wallet amount for a specific user
   * @param {string} userId - The user ID
   * @param {number} amount - The amount to set (minimum 0)
   * @returns {Promise<any>} The result of the flag update
   */
  static async setUserWallet(userId, amount) {
    return await this.currencyManager.setUserWallet(userId, amount);
  }

  /**
  * Gets all vendors from settings
  * @returns {Object} All vendors data
   */
  static getVendors() {
    try {
      return game.settings.get(this.ID, 'vendors');
    } catch (err) {
      console.warn('Setting gurps-instant-bazaar.vendors ausente', err);
      return {};
    }
  }

  /**
   * Gets a specific vendor by ID
   * @param {string} vendorId - The vendor ID
   * @returns {Object|undefined} The vendor data
   */
  static getVendor(vendorId) {
    const vendors = this.getVendors();
    return vendors[vendorId];
  }

  /**
   * Updates a vendor's data and notifies clients
   * @param {string} vendorId - The vendor ID
   * @param {Object} vendorData - The updated vendor data
   * @returns {Promise<void>}
   */
  static async updateVendor(vendorId, vendorData) {
    const vendors = this.getVendors();
    vendors[vendorId] = vendorData;
    await game.settings.set(this.ID, 'vendors', vendors);

    // Refresh local vendor windows so quantities update immediately
    this.refreshVendorManagers();
    this.refreshVendorDisplays(vendorId);

    // Notify all clients to refresh vendor displays
    game.socket.emit(this.SOCKET, {
      type: 'vendorUpdated',
      vendorId: vendorId,
      vendorData: vendorData
    });
  }

  /**
   * Deletes a vendor from the system
   * @param {string} vendorId - The vendor ID to delete
   * @returns {Promise<any>} The result of the settings update
   */
  static async deleteVendor(vendorId) {
    const vendors = this.getVendors();
    delete vendors[vendorId];
    return game.settings.set(this.ID, 'vendors', vendors);
  }

  /**
   * Handles socket events from other clients
   * @param {Object} data - The socket event data
   * @returns {void}
   */
  static handleSocketEvent(data) {
    switch (data.type) {
      case 'vendorUpdated':
        this.refreshVendorDisplays(data.vendorId);
        this.refreshVendorManagers();
        break;
      case 'itemPurchased':
        this.refreshVendorDisplays(data.vendorId);
        this.refreshVendorManagers();
        break;
      case 'playerPurchaseRequest':
        if (game.user.isGM) {
          this.processPlayerPurchaseRequest(data);
        }
        break;
      case 'playerSellRequest':
        if (game.user.isGM) {
          this.processPlayerSellRequest(data);
        }
        break;
    }
  }

  /**
   * Processes a player's purchase request (GM only)
   * @param {Object} data - Purchase request data containing userId, actorId, vendorId, and selectedItems
   * @returns {Promise<void>}
   */
  static async processPlayerPurchaseRequest(data) {
    const { userId, actorId, vendorId, selectedItems } = data;
    const actor = game.actors.get(actorId);
    const vendor = this.getVendor(vendorId);
    
    if (!actor || !vendor) {
      if (!actor) {
        this.emitPurchaseResult(userId, false, "Character not found by GM. Please ensure your character exists and has proper permissions.");
      } else {
        this.emitPurchaseResult(userId, false, "Vendor not found by GM. The vendor may have been deleted.");
      }
      return;
    }

    // Verify stock for each requested item
    const itemsWithStock = [];
    const insufficientItems = [];
    
    for (const selectedItem of selectedItems) {
      selectedItem.quantity = Number(selectedItem.quantity);
      if (!Number.isFinite(selectedItem.quantity) || selectedItem.quantity < 1) {
        selectedItem.quantity = 1;
      }
      const vendorItem = vendor.items.find(item => item.id === selectedItem.id);
      const stock = vendorItem?.quantity;
      if (!vendorItem || (stock !== undefined && stock < selectedItem.quantity)) {
        insufficientItems.push(selectedItem.name);
        continue;
      }
      itemsWithStock.push(selectedItem);
    }

    // Notify user about any items without sufficient stock
    for (const name of insufficientItems) {
      this.emitPurchaseResult(userId, false, `${name} is out of stock.`);
    }

    if (itemsWithStock.length === 0) return; // Nothing to process

    // Calculate total cost of items that can be purchased
    const totalCost = itemsWithStock.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const roundedTotalCost = totalCost;
    const currentWallet = this.getUserWallet(userId);

    if (currentWallet < roundedTotalCost) {
      this.emitPurchaseResult(userId, false, `Not enough coins! Need ${this.currencyManager.formatCurrency(roundedTotalCost)} but only have ${this.currencyManager.formatCurrency(currentWallet)}.`);
      return;
    }

    if (game.settings.get(this.ID, 'requireGMApproval')) {
      const itemList = itemsWithStock
        .map(item => `<li>${item.quantity}x ${item.name} - ${this.currencyManager.formatCurrency(item.price)}</li>`)
        .join('');
      const approved = await Dialog.confirm({
        title: 'Approve Purchase',
        content: `<p>${game.users.get(userId)?.name || 'A player'} wants to purchase:</p><ul>${itemList}</ul><p>Total: ${this.currencyManager.formatCurrency(roundedTotalCost)}</p>`
      });
      if (!approved) {
        this.emitPurchaseResult(userId, false, 'Purchase declined by GM.');
        return;
      }
    }

    try {
      // Process items using the macro logic
      let totalItemsProcessed = 0;
      let costProcessed = 0;
      let itemsAttempted = 0;

      for (const selectedItem of itemsWithStock) {
        const { uuid, quantity, id, price, name } = selectedItem;
        itemsAttempted++;
        const success = await VendorWalletSystem.addItemToActor(actor, uuid, quantity);
        
        if (!success) {
          this.emitPurchaseResult(userId, false, `Failed to add ${name} to ${actor.name}.`);
          continue;
        }

        totalItemsProcessed += quantity;
        costProcessed += price * quantity;

        // Remove purchased quantity from vendor
        await this.updateItemQuantityInVendor(vendorId, id, -quantity);
      }

      // Round up the final cost processed
      // Apply proper rounding to 1 decimal place
      costProcessed = Math.round(costProcessed * 10) / 10;

      if (totalItemsProcessed === 0) {
        this.emitPurchaseResult(userId, false, "No items were purchased.");
        return;
      }

      // Deduct money from wallet for successfully processed items
      await this.setUserWallet(userId, currentWallet - costProcessed);

      console.log(`💰 DEBUG: Wallet updated from ${currentWallet} to ${currentWallet - costProcessed}`);

      this.emitPurchaseResult(userId, true, `Purchased ${totalItemsProcessed} items for ${this.currencyManager.formatCurrency(costProcessed)}!`, {
        itemCount: totalItemsProcessed,
        totalCost: costProcessed,
        newWallet: currentWallet - costProcessed
      });

    } catch (error) {
      console.error(error);
      this.emitPurchaseResult(userId, false, `An error occurred while processing the purchase: ${error.message}`);
    }
  }
  
  /**
   * Emits a purchase result to the specified user
   * @param {string} userId - The user ID to send the result to
   * @param {boolean} success - Whether the purchase was successful
   * @param {string} message - The message to display
   * @param {Object} data - Additional data to include
   */
  static emitPurchaseResult(userId, success, message, data = {}) {
    game.socket.emit(this.SOCKET, {
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
  static async processPlayerSellRequest(data) {
    const { userId, actorId, selectedItems } = data;
    const actor = game.actors.get(actorId);
    const requireGMApproval = game.settings.get(this.ID, 'requireGMApproval');
    const automaticSellPercentage = game.settings.get(this.ID, 'automaticSellPercentage');
    
    if (!actor) {
      this.emitSellResult(userId, false, "Character not found by GM. Please ensure your character exists and has proper permissions.");
      return;
    }

    // Calculate total value of items to sell
    const totalValue = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let sellPercentage = automaticSellPercentage;
    
    if (requireGMApproval) {
      // Show GM approval dialog with percentage input
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
              display.textContent = window.VendorWalletSystem.currencyManager.formatCurrency(payment);
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
        this.emitSellResult(userId, false, 'Sale declined by GM.');
        return;
      }
      
      sellPercentage = Math.max(0, Math.min(100, result.percentage));
    } else {
      // Automatic sale without GM approval
      console.log(`💰 AUTOMATIC SALE: Processing automatic sale at ${sellPercentage}% for user ${userId}`);
    }

    try {
      // Process the sale
      let totalItemsProcessed = 0;
      let totalValueProcessed = 0;

      for (const selectedItem of selectedItems) {
        const { id, quantity, price, uuid } = selectedItem;
        
        // For GURPS equipment items, we need to update the carried equipment directly
        const carried = actor.system?.equipment?.carried;
        if (!carried) {
          console.warn(`No carried equipment found for actor ${actor.name}`);
          continue;
        }
        
        // Find the item in the carried equipment structure
        const itemPath = this._findItemInCarried(carried, id);
        if (!itemPath) {
          console.warn(`Item ${id} not found in carried equipment for actor ${actor.name}`);
          continue;
        }
        
        const itemData = this._getItemFromPath(carried, itemPath);
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

        totalItemsProcessed += quantity;
        totalValueProcessed += price * quantity;
      }

      if (totalItemsProcessed === 0) {
        this.emitSellResult(userId, false, "No items were sold.");
        return;
      }

      // Calculate final payment
      const finalPayment = (totalValueProcessed * sellPercentage) / 100;
      
      // Check if module currency system is disabled
      const useModuleCurrency = game.settings.get(this.ID, 'useModuleCurrencySystem');
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
      const currentWallet = this.getUserWallet(userId);
      await this.setUserWallet(userId, currentWallet + processedFinalPayment);

      const saleMessage = requireGMApproval 
        ? `Sold ${totalItemsProcessed} items for ${this.currencyManager.formatCurrency(processedFinalPayment)} (${sellPercentage}% of ${this.currencyManager.formatCurrency(totalValueProcessed)})!`
        : `Automatically sold ${totalItemsProcessed} items for ${this.currencyManager.formatCurrency(processedFinalPayment)} (${sellPercentage}% of ${this.currencyManager.formatCurrency(totalValueProcessed)})!`;
      
      this.emitSellResult(userId, true, saleMessage);

    } catch (error) {
      console.error(error);
      this.emitSellResult(userId, false, `An error occurred while processing the sale: ${error.message}`);
    }
  }

  /**
   * Recursively finds an item in the carried equipment structure
   * @param {Object} carried - The carried equipment object
   * @param {string} itemId - The item ID to find
   * @param {string} [currentPath=''] - Current path in the structure
   * @returns {string|null} The path to the item or null if not found
   */
  static _findItemInCarried(carried, itemId, currentPath = '') {
    for (const [key, value] of Object.entries(carried)) {
      const path = currentPath ? `${currentPath}.${key}` : key;
      
      if (key === itemId) {
        return path;
      }
      
      if (value && typeof value === 'object' && value.collapsed) {
        const nestedPath = this._findItemInCarried(value.collapsed, itemId, `${path}.collapsed`);
        if (nestedPath) return nestedPath;
      }
    }
    return null;
  }

  /**
   * Gets an item from a path in the carried equipment structure
   * @param {Object} carried - The carried equipment object
   * @param {string} path - The path to the item
   * @returns {Object|null} The item data or null if not found
   */
  static _getItemFromPath(carried, path) {
    const pathParts = path.split('.');
    let current = carried;
    
    for (const part of pathParts) {
      if (current && typeof current === 'object' && current[part] !== undefined) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return current;
  }
  /**
   * Emits a sell result to the specified user
   * @param {string} userId - The user ID to send the result to
   * @param {boolean} success - Whether the sale was successful
   * @param {string} message - The message to display
   * @param {Object} data - Additional data to include
   */
  static emitSellResult(userId, success, message, data = {}) {
    game.socket.emit(this.SOCKET, {
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
  static async addItemToActor(actor, uuid, quantity) {
    console.log(`🔍 DEBUG QUANTITY - Value: ${quantity}, Type: ${typeof quantity}`);
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
        console.error(`💰 ERROR: Item was not added to character (UUID: ${uuid})`);
        return false;
      }

        // For newly created items, set the quantity directly
      console.log(`🔍 DEBUG NEW ITEM - Setting quantity to: ${quantity}`);
      
        // Wait a tick to ensure the item was fully created
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const eqtUuid = item.system?.eqt?.uuid;
      const key = eqtUuid ? actor._findEqtkeyForId("uuid", eqtUuid) : undefined;

      if (typeof actor.updateEqtCount === "function" && key) {
        console.log(`🔍 DEBUG NEW ITEM - Using updateEqtCount with key: ${key}`);
        await actor.updateEqtCount(key, quantity);
      } else {
        console.log(`🔍 DEBUG NEW ITEM - Using item.update for eqt.count`);
        await item.update({ "system.eqt.count": quantity });
      }
      
      console.log(`🔍 DEBUG NEW ITEM - Final count: ${item.system?.eqt?.count}`);

      return true;
    }
  }

  /**
   * Refreshes all open vendor display windows for a specific vendor
   * @param {string} vendorId - The vendor ID to refresh displays for
   * @returns {void}
   */
  static refreshVendorDisplays(vendorId) {
    // Refresh all open vendor display windows for this vendor
    Object.values(ui.windows).forEach(window => {
      if (window instanceof VendorDisplayApplication && window.vendorId === vendorId) {
        window.render();
      }
    });
  }

  /**
   * Refreshes all open vendor manager windows
   * @returns {void}
   */
  static refreshVendorManagers() {
    Object.values(ui.windows).forEach(window => {
      if (window instanceof VendorManagerApplication) {
        window.render();
      }
    });
  }

  /**
   * Opens the player wallet application showing all available vendors
   * @returns {void}
   */
  static openAllAvailableVendors() {
    new PlayerWalletApplication().render(true);
  }

  /**
   * Processes an item purchase transaction
   * @param {Actor} actor - The purchasing actor
   * @param {Item} item - The item to purchase
   * @param {string} vendorId - The vendor ID
   * @param {string} vendorItemId - The vendor item ID
   * @param {number} [quantity=1] - Quantity being purchased
   * @returns {Promise<boolean>} True if purchase was successful
   */
  static async processItemPurchase(actor, item, vendorId, vendorItemId, quantity = 1) {
    return await this.currencyManager.processItemPurchase(actor, item, vendorId, vendorItemId, quantity);
  }

  /**
   * Updates the quantity of an item in a vendor's inventory
   * @param {string} vendorId - The vendor ID
   * @param {string} vendorItemId - The vendor item ID
   * @param {number} change - The quantity change (positive or negative)
   * @returns {Promise<void>}
   */
  static async updateItemQuantityInVendor(vendorId, vendorItemId, change) {
    const vendor = VendorWalletSystem.getVendor(vendorId);
    if (!vendor) return;

    // Find the item and update its quantity
    const itemIndex = vendor.items.findIndex(item => item.id === vendorItemId);
    
    if (itemIndex === -1) {
      return;
    }
    
    const item = vendor.items[itemIndex];
    const currentQuantity = item.quantity || 1;
    const newQuantity = Math.max(0, currentQuantity + change);
    
    if (newQuantity <= 0) {
      // Remove item completely if quantity reaches 0
      vendor.items = vendor.items.filter(item => item.id !== vendorItemId);
    } else {
      // Update the quantity
      vendor.items[itemIndex].quantity = newQuantity;
    }

    // Update the vendor
    await VendorWalletSystem.updateVendor(vendorId, vendor);

    // Refresh local vendor manager windows
    this.refreshVendorManagers();

    // Notify all clients about the item purchase
    game.socket.emit(this.SOCKET, {
      type: 'itemPurchased',
      vendorId: vendorId,
      itemId: vendorItemId
    });
  }

  /**
   * Finds a vendor that contains an item with the specified UUID
   * @param {string} itemUuid - The item UUID to search for
   * @returns {Object|null} Object containing vendorId and vendorItemId, or null if not found
   */
  static findVendorByItemUuid(itemUuid) {
    const vendors = VendorWalletSystem.getVendors();
    for (const [vendorId, vendor] of Object.entries(vendors)) {
      const vendorItem = vendor.items.find(item => item.uuid === itemUuid);
      if (vendorItem) {
        return { vendorId, vendorItemId: vendorItem.id };
      }
    }
    return null;
  }

  /**
   * Handles item drop events for vendor purchases
   * @param {Actor} actor - The target actor
   * @param {Object|string} data - The drop data
   * @returns {Promise<boolean>} True to allow default behavior, false to prevent it
   */
  static async handleItemDrop(actor, data) {
    // Handle case where data might be a string (from dataTransfer)
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return true; // Let Foundry handle it normally
      }
    }
    
    if (data.type !== "Item") return;

    const item = await fromUuid(data.uuid);
    if (!item) return;

    // Check if this item comes from a vendor using drag data
    if (data.vendorId && data.vendorItemId) {
      let quantity = parseInt(data.quantity, 10);

      if (!quantity || quantity < 1) {
        const vendor = VendorWalletSystem.getVendor(data.vendorId);
        const vendorItem = vendor?.items.find(i => i.id === data.vendorItemId);
        const maxStock = vendorItem?.quantity;

        quantity = await Dialog.prompt({
          title: `Purchase Quantity`,
          content: `<p>How many ${item.name}?</p><input type="number" id="purchase-qty" value="1" min="1" ${maxStock !== undefined ? `max="${maxStock}"` : ''}>`,
          callback: html => parseInt(html.find('#purchase-qty').val(), 10) || 1
        });
      }

      await VendorWalletSystem.processItemPurchase(actor, item, data.vendorId, data.vendorItemId, quantity);
      return false; // Prevent default item drop behavior
    } else {
      // Regular item drop, let Foundry handle it normally
      return true;
    }
  }
}

// Initialize the system when FoundryVTT is ready
Hooks.once('init', () => {

  const UserClass = CONFIG.User?.documentClass ?? game?.user?.constructor;
  if (UserClass?.registerFlagScope) {
    UserClass.registerFlagScope(VendorWalletSystem.ID);
  } else {
    console.warn('User.registerFlagScope unavailable; wallet flags may fail.');

  }
  VendorWalletSystem.initialize();
});

// Add wallet button to player list
Hooks.on('renderPlayerList', VendorWalletSystem.addPlayerWalletButton.bind(VendorWalletSystem));

// Make GM Tools application available after ready
Hooks.on('ready', () => {
  // Ensure GMToolsApplication is available
  if (typeof GMToolsApplication !== 'undefined') {
    VendorWalletSystem.GMToolsApplication = GMToolsApplication;
  }
  
  // Register the /shop chat command
  // Simple /shop command registration
  Hooks.on('chatMessage', (chatLog, message, chatData) => {
    if (message.trim() === '/shop') {
      if (game.user.isGM) {
        if (typeof GMToolsApplication !== 'undefined') {
          new GMToolsApplication().render(true);
        } else {
          ui.notifications.error('GM Tools not available');
        }
      } else {
        VendorWalletSystem.openAllAvailableVendors();
      }
      return false; // Prevent the message from being sent to chat
    }
  });
});

// Hook for handling item drops on canvas
Hooks.on('dropCanvasData', async (canvas, data) => {
  // Only handle item drops
  if (data.type !== 'Item') return true;
  
  // Get the target actor (if any)
  const targetToken = canvas.tokens.controlled[0];
  if (!targetToken || !targetToken.actor) return true;
  
  const actor = targetToken.actor;
  
  // Check if user has permission to modify this actor
  if (!actor.isOwner) return true;
  
  // Handle the item drop using our system
  const result = await VendorWalletSystem.handleItemDrop(actor, data);
  
  // Return false to prevent default behavior if we handled it
  return result;
});
// Expose the main class globally
window.VendorWalletSystem = VendorWalletSystem;
// Also expose handleItemDrop globally for compatibility with other modules
window.handleItemDrop = VendorWalletSystem.handleItemDrop.bind(VendorWalletSystem);