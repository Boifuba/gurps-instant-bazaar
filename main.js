/**
 * @file Main module file for the Vendor Wallet System
 * @description Provides core functionality for managing vendors, player wallets, and item transactions in FoundryVTT
 */

console.log("🔧 VENDOR WALLET SYSTEM: main.js loaded!");

const currencyService = require('./currency-service.js');
const vendorService = require('./vendor-service.js');
const inventoryUtils = require('./inventory-utils.js');

/**
 * @class VendorWalletSystem
 * @description Core class that manages the vendor and wallet system functionality
 */
class VendorWalletSystem {
  /** @type {string} Module identifier */
  static ID = vendorService.MODULE_ID;

  /** @type {string} Socket identifier for module communication */
  static SOCKET = vendorService.SOCKET;

  /**
   * Formats a numeric amount as currency string
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string
   */
  static formatCurrency(amount) {
    return currencyService.formatCurrency(amount);
  }

  /**
   * Parses a currency-formatted string into a numeric value
   * @param {string|number} value - The currency string or number
   * @returns {number} Parsed numeric value
   */
  static parseCurrency(value) {
    return currencyService.parseCurrency(value);
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
    return currencyService.getUserWallet(userId);
  }

  /**
   * Recursively flattens an object to extract all item-like objects.
   * Assumes an item-like object has at least a 'name' property.
   * @param {Object} obj - The object to flatten.
   * @returns {Array<Object>} An array of item-like objects.
   */
  static _flattenItemsFromObject(obj) {
    return currencyService._flattenItemsFromObject(obj);
  }

  /**
   * Gets the wallet amount from character sheet currency items
   * @param {string} userId - The user ID
   * @returns {number} The total wallet amount from character sheet
   */
  static _getCharacterSheetCurrency(userId) {
    return currencyService._getCharacterSheetCurrency(userId);
  }

  /**
   * Gets the breakdown of currency coins from character sheet
   * @param {string} userId - The user ID
   * @returns {Array<{name: string, totalValue: number}>} Array of coin breakdown objects
   */
  static _getCharacterSheetCoinBreakdown(userId) {
    return currencyService._getCharacterSheetCoinBreakdown(userId);
  }

  /**
   * Sets the wallet amount for a specific user
   * @param {string} userId - The user ID
   * @param {number} amount - The amount to set (minimum 0)
   * @returns {Promise<any>} The result of the flag update
   */
  static async setUserWallet(userId, amount) {
    return currencyService.setUserWallet(userId, amount);
  }

  /**
  * Gets all vendors from settings
  * @returns {Object} All vendors data
   */
  static getVendors() {
    return vendorService.getVendors();
  }

  /**
   * Gets a specific vendor by ID
   * @param {string} vendorId - The vendor ID
   * @returns {Object|undefined} The vendor data
   */
  static getVendor(vendorId) {
    return vendorService.getVendor(vendorId);
  }

  /**
   * Updates a vendor's data and notifies clients
   * @param {string} vendorId - The vendor ID
   * @param {Object} vendorData - The updated vendor data
   * @returns {Promise<void>}
   */
  static async updateVendor(vendorId, vendorData) {
    return vendorService.updateVendor(vendorId, vendorData);
  }

  /**
   * Deletes a vendor from the system
   * @param {string} vendorId - The vendor ID to delete
   * @returns {Promise<any>} The result of the settings update
   */
  static async deleteVendor(vendorId) {
    return vendorService.deleteVendor(vendorId);
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
    return inventoryUtils.addItemToActor(actor, uuid, quantity);
  }

  /**
   * Refreshes all open vendor display windows for a specific vendor
   * @param {string} vendorId - The vendor ID to refresh displays for
   */
  static refreshVendorDisplays(vendorId) {
    return vendorService.refreshVendorDisplays(vendorId);
  }

  /**
   * Refreshes all open vendor manager windows
   */
  static refreshVendorManagers() {
    return vendorService.refreshVendorManagers();
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
    return inventoryUtils.processItemPurchase(actor, item, vendorId, vendorItemId, quantity);
  }

  /**
   * Updates the quantity of an item in a vendor's inventory
   * @param {string} vendorId - The vendor ID
   * @param {string} vendorItemId - The vendor item ID
   * @param {number} change - The quantity change (positive or negative)
   * @returns {Promise<void>}
   */
  static async updateItemQuantityInVendor(vendorId, vendorItemId, change) {
    return vendorService.updateItemQuantityInVendor(vendorId, vendorItemId, change);
  }

  /**
   * Finds a vendor that contains an item with the specified UUID
   * @param {string} itemUuid - The item UUID to search for
   * @returns {Object|null} Object containing vendorId and vendorItemId, or null if not found
   */
  static findVendorByItemUuid(itemUuid) {
    return vendorService.findVendorByItemUuid(itemUuid);
  }

  /**
   * Handles item drop events for vendor purchases
   * @param {Actor} actor - The target actor
   * @param {Object|string} data - The drop data
   * @returns {Promise<boolean>} True to allow default behavior, false to prevent it
   */
  static async handleItemDrop(actor, data) {
    return inventoryUtils.handleItemDrop(actor, data);
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