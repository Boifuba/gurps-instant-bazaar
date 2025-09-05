/**
 * @file Main module file for the Vendor Wallet System
 * @description Provides core functionality for managing vendors, player wallets, and item transactions in FoundryVTT
 */

import { Wallet, valueFromCoins } from './currency.js';

console.log("🔧 VENDOR WALLET SYSTEM: main.js loaded!");

/**
 * @class VendorWalletSystem
 * @description Core class that manages the vendor and wallet system functionality
 */
class VendorWalletSystem {
  /** @type {string} Module identifier */
  static ID = 'gurps-instant-bazaar';
  
  /** @type {string} Socket identifier for module communication */
  static SOCKET = `module.${VendorWalletSystem.ID}`;

  /**
   * Formats a numeric amount as currency string
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string
   */
  static formatCurrency(amount) {
    return '$' + Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Parses a currency-formatted string into a numeric value
   * @param {string|number} value - The currency string or number
   * @returns {number} Parsed numeric value
   */
  static parseCurrency(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return Number(value.replace(/[^0-9.-]+/g, '')) || 0;
    }
    return 0;
  }

  /**
   * Initializes the module by registering settings, socket listeners, and handlebars helpers
   */
  static initialize() {
    this.registerSettings();
    this.registerSocketListeners();
    if (typeof Handlebars !== 'undefined') {
      Handlebars.registerHelper('formatCurrency', this.formatCurrency);
      Handlebars.registerHelper('join', (arr, sep) => Array.isArray(arr) ? arr.join(sep) : '');
    }
  }

  /**
   * Registers module settings with FoundryVTT
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
      scope: 'world',
      config: false,
      type: Boolean,
      default: true
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
    game.settings.register(this.ID, 'requirePurchaseApproval', {
      name: 'Require GM Purchase Approval',
      hint: 'If enabled, the GM must approve player purchase requests.',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    });
  }

  /**
   * Registers socket event listeners for real-time communication
   */
  static registerSocketListeners() {
    game.socket.on(this.SOCKET, this.handleSocketEvent.bind(this));
  }

  /**
   * Adds a wallet button to the player list interface
   * @param {Application} app - The FoundryVTT application
   * @param {jQuery} html - The HTML element
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
    console.log('💰 DEBUG getUserWallet - userId:', userId);
    
    // Check if module currency system is enabled
    const useModuleCurrency = game.settings.get(this.ID, 'useModuleCurrencySystem');
    console.log('💰 DEBUG getUserWallet - useModuleCurrency:', useModuleCurrency);
    
    if (!useModuleCurrency) {
      // Use character sheet currency system
      console.log('💰 DEBUG getUserWallet - Using character sheet currency system');
      return this._getCharacterSheetCurrency(userId);
    }
    
    console.log('💰 DEBUG getUserWallet - Using module currency system');
    const user = game.users.get(userId);
    return Number(user?.getFlag(this.ID, 'wallet')) || 0;
  }

  /**
   * Recursively flattens an object to extract all item-like objects.
   * Assumes an item-like object has at least a 'name' property.
   * @param {Object} obj - The object to flatten.
   * @returns {Array<Object>} An array of item-like objects.
   */
  static _flattenItemsFromObject(obj) {
    const items = [];
    if (typeof obj !== 'object' || obj === null) {
      return items;
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          // Heuristic: if it has a 'name' property, consider it an item.
          // You might want to add more specific checks if your system has other unique item properties.
          if (value.name !== undefined) {
            items.push(value);
          } else {
            // If not an item, recurse into the nested object
            items.push(...VendorWalletSystem._flattenItemsFromObject(value));
          }
        }
      }
    }
    return items;
  }

  /**
   * Gets the wallet amount from character sheet currency items
   * @param {string} userId - The user ID
   * @returns {number} The total wallet amount from character sheet
   */
  static _getCharacterSheetCurrency(userId) {
    const coinBreakdown = this._getCharacterSheetCoinBreakdown(userId);
    let totalValue = 0;
    for (const coin of coinBreakdown) {
      totalValue += coin.totalValue;
    }
    return totalValue;
  }

  /**
   * Gets the breakdown of currency coins from character sheet
   * @param {string} userId - The user ID
   * @returns {Array<{name: string, totalValue: number}>} Array of coin breakdown objects
   */
  static _getCharacterSheetCoinBreakdown(userId) {
    console.log('💰 DEBUG _getCharacterSheetCurrency - userId:', userId);
    
    const user = game.users.get(userId);
    console.log('💰 DEBUG _getCharacterSheetCurrency - user:', user);
    
    if (!user?.character) {
      console.warn(`No character assigned to user ${user?.name || userId}`);
      return [];
    }

    const actor = user.character;
    console.log('💰 DEBUG _getCharacterSheetCurrency - actor:', actor.name, 'ID:', actor.id);
    
    const carried = actor.system?.equipment?.carried;
    console.log('💰 DEBUG _getCharacterSheetCurrency - carried:', carried);
    
    if (!carried) {
      console.warn(`No equipment.carried found for character ${actor.name}`);
      return [];
    }

    // Get currency denominations from settings
    const denominations = game.settings.get(this.ID, 'currencyDenominations') || [];
    console.log('💰 DEBUG _getCharacterSheetCurrency - denominations:', denominations);
    
    const coinBreakdown = [];

    // Convert carried object to array for easier processing
    // MODIFICAÇÃO AQUI: Use a nova função auxiliar para aplanar o objeto
    const carriedItems = VendorWalletSystem._flattenItemsFromObject(carried);
    console.log('💰 DEBUG _getCharacterSheetCurrency - carriedItems count (flattened):', carriedItems.length);

    // For each denomination, find matching items in character sheet
    for (const denom of denominations) {
      console.log('💰 DEBUG _getCharacterSheetCurrency - Processing denomination:', denom.name, 'value:', denom.value);
      console.log(`💰 DEBUG: Looking for item with name "${denom.name}"`);
      
      const matchingItems = carriedItems.filter(item => 
        {
          console.log(`💰 DEBUG: Comparing with character sheet item "${item.name}"`);
          return item.name === denom.name && item.carried === true;
        }
      );
      console.log('💰 DEBUG _getCharacterSheetCurrency - matchingItems for', denom.name, ':', matchingItems);

      for (const item of matchingItems) {
        const count = item.count || 0;
        const value = denom.value || 0;
        console.log('💰 DEBUG _getCharacterSheetCurrency - Item:', item.name, 'count:', count, 'value per unit:', value, 'total value:', count * value);
        if (count > 0 && value > 0) {
          coinBreakdown.push({
            name: denom.name,
            totalValue: count * value
          });
        }
      }
    }

    console.log('💰 DEBUG _getCharacterSheetCoinBreakdown - Final coinBreakdown:', coinBreakdown);
    return coinBreakdown;
  }

  static async _setCharacterSheetCurrency(userId, spendValue) {
    const user = game.users.get(userId);
    const actor = user?.character;
    if (!actor) return 0;

    const coinBreakdown = this._getCharacterSheetCoinBreakdown(userId);
    const wallet = new Wallet();
    for (const coin of coinBreakdown) wallet.add(coin.totalValue);

    try {
      wallet.subtract(spendValue);
    } catch (err) {
      ui.notifications?.warn(err.message);
      return wallet.total();
    }

    const denominations = game.settings.get(this.ID, 'currencyDenominations') || [];
    const updates = [];

    for (const denom of denominations) {
      const item = actor.items.find(i => i.name === denom.name && i.system?.eqt?.count !== undefined);
      if (!item) continue;

      let newCount = 0;
      if (denom.value === 80) newCount = wallet.ouro;
      else if (denom.value === 4) newCount = wallet.prata;
      else newCount = wallet.cobre;

      updates.push({ _id: item.id, 'system.eqt.count': newCount });
    }

    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);

    const finalTotal = wallet.total();
    console.log('💰 DEBUG _setCharacterSheetCurrency - final total:', finalTotal, valueFromCoins(wallet));
    return finalTotal;
  }

  /**
   * Sets the wallet amount for a specific user
   * @param {string} userId - The user ID
   * @param {number} amount - The amount to set (minimum 0)
   * @returns {Promise<any>} The result of the flag update
   */
  static async setUserWallet(userId, amount) {
    // Check if module currency system is enabled
    const useModuleCurrency = game.settings.get(this.ID, 'useModuleCurrencySystem');
    if (!useModuleCurrency) {
      console.warn('Module currency system is disabled. Direct wallet changes are not allowed. Currency is managed through character sheet items.');
      return false; // Don't allow wallet changes when module currency system is disabled
    }
    
    const user = game.users.get(userId);
    const result = await user?.setFlag(this.ID, 'wallet', Math.max(0, amount));
    return result;
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
    const currentWallet = this.getUserWallet(userId);

    if (currentWallet < totalCost) {
      this.emitPurchaseResult(userId, false, `Not enough coins! Need ${VendorWalletSystem.formatCurrency(totalCost)} but only have ${VendorWalletSystem.formatCurrency(currentWallet)}.`);
      return;
    }

    if (game.settings.get(this.ID, 'requirePurchaseApproval')) {
      const itemList = itemsWithStock
        .map(item => `<li>${item.quantity}x ${item.name} - ${VendorWalletSystem.formatCurrency(item.price)}</li>`)
        .join('');
      const approved = await Dialog.confirm({
        title: 'Approve Purchase',
        content: `<p>${game.users.get(userId)?.name || 'A player'} wants to purchase:</p><ul>${itemList}</ul><p>Total: ${VendorWalletSystem.formatCurrency(totalCost)}</p>`
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

      if (totalItemsProcessed === 0) {
        this.emitPurchaseResult(userId, false, "No items were purchased.");
        return;
      }

      // Deduct money from wallet for successfully processed items
      await this.setUserWallet(userId, currentWallet - costProcessed);

      this.emitPurchaseResult(userId, true, `Purchased ${totalItemsProcessed} items for ${VendorWalletSystem.formatCurrency(costProcessed)}!`, {
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
      // Para itens existentes, soma a quantidade atual com a nova
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

      // Para itens recém-criados, define a quantidade diretamente
      console.log(`🔍 DEBUG NEW ITEM - Setting quantity to: ${quantity}`);
      
      // Aguarda um tick para garantir que o item foi completamente criado
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
    const userId = game.user.id;
    const currentWallet = VendorWalletSystem.getUserWallet(userId);
    const itemPrice = parseInt(
    ) || 0;

    // Verify vendor stock if available
    if (vendorId && vendorItemId) {
      const vendor = VendorWalletSystem.getVendor(vendorId);
      const vendorItem = vendor?.items.find(i => i.id === vendorItemId);
      const stock = vendorItem?.quantity;
      if (stock !== undefined && stock < quantity) {
        ui.notifications.warn(`${item.name} is out of stock.`);
        return false;
      }
    }

    const totalPrice = itemPrice * quantity;

    if (currentWallet >= totalPrice) {
      // Debit money from appropriate wallet
      const useModuleCurrency = game.settings.get(this.ID, 'useModuleCurrencySystem');
      if (useModuleCurrency) {
        await VendorWalletSystem.setUserWallet(userId, currentWallet - totalPrice);
      } else {
        await this._setCharacterSheetCurrency(userId, totalPrice);
      }
      // Add item to actor, updating quantity if it already exists
      const sourceId =
        item._stats?.compendiumSource ||
        item.flags?.core?.sourceId ||
        item.system?.globalid;
      let actorItem = sourceId
        ? actor.items.find(i =>
            i._stats?.compendiumSource === sourceId ||
            i.flags?.core?.sourceId === sourceId ||
            i.system?.globalid === sourceId
          )
        : null;

      if (actorItem) {
        // Determine which quantity path to use
        const isEquipment = actorItem.system?.eqt?.count !== undefined;
        const path = isEquipment ? "system.eqt.count" : "system.quantity";
        const total = (getProperty(actorItem, path) ?? 0) + quantity;

        // Update using system-specific method
        if (isEquipment) {
          const key = actor._findEqtkeyForId("itemid", actorItem.id);

          if (!key || typeof actor.updateEqtCount !== "function") {
            await actorItem.update({ [path]: total });
          } else {
            await actor.updateEqtCount(key, total);
          }
        } else {
          await actorItem.update({ [path]: total });
        }
      } else {
        // Create the item with initial quantity
        const itemData = item.toObject();
        delete itemData._id; // Ensure new _id is generated
        itemData._stats ??= {};
        itemData._stats.compendiumSource = sourceId;
        if (itemData.system?.eqt?.count !== undefined) itemData.system.eqt.count = quantity;
        else itemData.system.quantity = quantity;

        await actor.createEmbeddedDocuments('Item', [itemData]);
      }

      // Remove item from vendor
      if (vendorId && vendorItemId) {
        await VendorWalletSystem.updateItemQuantityInVendor(vendorId, vendorItemId, -quantity);
      }

      ui.notifications.info(`${quantity}x ${item.name} purchased for ${VendorWalletSystem.formatCurrency(totalPrice)} and added to ${actor.name}'s inventory.`);
      return true;
    } else {
      ui.notifications.warn(`Not enough coins to purchase ${quantity}x ${item.name}. Need ${VendorWalletSystem.formatCurrency(totalPrice)} but only have ${VendorWalletSystem.formatCurrency(currentWallet)}.`);
      return false;
    }
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
    console.warn('User.registerFlagScope indisponível; flags de carteira podem falhar.');

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
  if (typeof game.chatCommands !== 'undefined' && game.chatCommands.register) {
    game.chatCommands.register({
      name: '/shop',
      module: VendorWalletSystem.ID,
      description: 'Opens vendor interface (GM Tools for GMs, Player Wallet for players)',
      icon: '<i class="fas fa-store"></i>',
      callback: () => {
        if (game.user.isGM) {
          if (typeof GMToolsApplication !== 'undefined') {
            new GMToolsApplication().render(true);
          } else {
            ui.notifications.error('GM Tools not available');
          }
        } else {
          VendorWalletSystem.openAllAvailableVendors();
        }
      }
    });
  } else {
    // Fallback for systems without chatCommands API
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
  }
});

// Expose the main class globally
window.VendorWalletSystem = VendorWalletSystem;