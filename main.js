/**
 * @file Main module file for the Vendor Wallet System
 * @description Provides core functionality for managing vendors, player wallets, and item transactions in FoundryVTT
 */

// Import dependencies
import CurrencyManager from './currency.js';
import TransactionManager from './transaction-manager.js';
import VendorDataManager from './vendor-data-manager.js';
import VendorDisplayApplication from './vendor-display-app.js';
import VendorManagerApplication from './vendor-manager-app.js';
import MoneyManagementApplication from './money-management-app.js';
import { initializeUIIntegrations } from './ui-integrations.js';
import { initializeItemDropHandling } from './item-drop-handler.js';
import { registerModuleSettings } from './settings.js';
import PlayerWalletApplication from './player-wallet-app.js';
import GMToolsApplication from './gm-tools-app.js';
import SellItemsApplication from './sell-items-app.js';
import VendorCreationApplication from './vendor-creation-app.js';
import VendorEditApplication from './vendor-edit-app.js';
import VendorItemEditApplication from './vendor-item-edit-app.js';
import CurrencySettingsApplication from './currency-settings-app.js';
import * as Utils from './utils.js';


console.log("🐮 VENDOR WALLET SYSTEM: main.js loaded!");

/**
 * @class VendorWalletSystem
 * @description Core class that manages the vendor and wallet system functionality
 */
export default class VendorWalletSystem {
  /** @type {string} Module identifier */
  static ID = 'gurps-instant-bazaar';
  
  /** @type {string} Socket identifier for module communication */
  static SOCKET = `module.${VendorWalletSystem.ID}`;

  /** @type {CurrencyManager} Currency manager instance */
  static currencyManager = null;

  /** @type {VendorDataManager} Vendor data manager instance */
  static vendorDataManager = null;

  /** @type {TransactionManager} Transaction manager instance */
  static transactionManager = null;
  /**
   * Initializes the module by registering settings, socket listeners, and handlebars helpers
   * @returns {void}
   */
  static initialize() {
    registerModuleSettings(this.ID);
    this.registerSocketListeners();
    
    // Initialize currency manager
    this.currencyManager = new CurrencyManager(this.ID);
    
    // Initialize vendor data manager
    this.vendorDataManager = new VendorDataManager(this.ID, this.SOCKET);
    
    // Initialize transaction manager
    this.transactionManager = new TransactionManager(this.ID, this.SOCKET, this.currencyManager, this.vendorDataManager);
    
    if (typeof Handlebars !== 'undefined') {
      // Register the formatCurrency helper to ensure it's always available
      Handlebars.registerHelper('formatCurrency', (amount) => {
        return this.currencyManager.formatCurrency(amount);
      });
      Handlebars.registerHelper('join', (arr, sep) => Array.isArray(arr) ? arr.join(sep) : '');
    }
  }


  /**
   * Registers socket event listeners for real-time communication
   * @returns {void}
   */
  static registerSocketListeners() {
    game.socket.on(this.SOCKET, this.handleSocketEvent.bind(this));
  }

  // Convenience methods for accessing manager functionality
  static formatCurrency(amount) { return this.currencyManager.formatCurrency(amount); }
  static parseCurrency(value) { return this.currencyManager.parseCurrency(value); }
  static getVendors() { return this.vendorDataManager.getVendors(); }
  static getVendor(vendorId) { return this.vendorDataManager.getVendor(vendorId); }
  static async updateVendor(vendorId, vendorData) { return this.vendorDataManager.updateVendor(vendorId, vendorData); }
  static async deleteVendor(vendorId) { return this.vendorDataManager.deleteVendor(vendorId); }
  static async updateItemQuantityInVendor(vendorId, vendorItemId, change) { return this.vendorDataManager.updateItemQuantityInVendor(vendorId, vendorItemId, change); }
  static findVendorByItemUuid(itemUuid) { return this.vendorDataManager.findVendorByItemUuid(itemUuid); }

  /**
   * Handles socket events from other clients
   * @param {Object} data - The socket event data
   * @returns {void}
   */
  static handleSocketEvent(data) {
    switch (data.type) {
      case 'vendorUpdated':
        VendorDisplayApplication?.refreshDisplays(data.vendorId);
        VendorManagerApplication?.refreshVendors();
        break;
      case 'itemPurchased':
        VendorDisplayApplication?.refreshDisplays(data.vendorId);
        VendorManagerApplication?.refreshVendors();
        break;
      case 'playerPurchaseRequest':
        if (game.user.isGM) {
          this.transactionManager.processPlayerPurchaseRequest(data);
        }
        break;
      case 'playerSellRequest':
        if (game.user.isGM) {
          this.transactionManager.processPlayerSellRequest(data);
        }
        break;
    }
  }

  /**
   * Opens the player wallet application showing all available vendors
   * @returns {void}
   */
  static openAllAvailableVendors() {
    new PlayerWalletApplication().render(true);
  }

  /**
   * Initializes missing currency denominations for all actors without affecting existing coins
   * @returns {Promise<void>}
   */
  static async initializeMissingActorCoins() {
    // Only GMs can reset actor coins
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can initialize actor coins!');
      return;
    }

    // Check if module currency system is enabled
    const useModuleCurrency = game.settings.get(this.ID, 'useModuleCurrencySystem');
    if (useModuleCurrency) {
      ui.notifications.warn('This tool is for character sheet currency management. The module currency system is currently enabled. Disable it in settings to use this feature.');
      return;
    }

    try {
      await this.currencyManager.initializeMissingActorCoins();
      ui.notifications.info('Missing actor currency denominations have been initialized successfully!');
    } catch (error) {
      console.error('Error initializing actor coins:', error);
      ui.notifications.error('Failed to initialize actor coins. Check console for details.');
    }
  }
}

// Make all classes and utilities globally accessible for macros and external scripts

// Initialize the system when FoundryVTT is ready
Hooks.once('init', () => {
  const UserClass = CONFIG.User?.documentClass ?? game?.user?.constructor;
  if (UserClass?.registerFlagScope) {
    UserClass.registerFlagScope(VendorWalletSystem.ID);
  } else {
    console.warn('User.registerFlagScope unavailable; wallet flags may fail.');
  }
  VendorWalletSystem.initialize();
  
  // Initialize UI integrations
  initializeUIIntegrations();
  
  // Initialize item drop handling
  initializeItemDropHandling();
  
  // Make all classes and utilities globally accessible for macros and external scripts
  window.VendorWalletSystem = VendorWalletSystem;
  window.PlayerWalletApplication = PlayerWalletApplication;
  window.GMToolsApplication = GMToolsApplication;
  window.SellItemsApplication = SellItemsApplication;
  window.VendorCreationApplication = VendorCreationApplication;
  window.VendorEditApplication = VendorEditApplication;
  window.VendorItemEditApplication = VendorItemEditApplication;
  window.CurrencySettingsApplication = CurrencySettingsApplication;
  window.VendorDisplayApplication = VendorDisplayApplication;
  window.VendorManagerApplication = VendorManagerApplication;
  window.MoneyManagementApplication = MoneyManagementApplication;

  // Make utility functions globally available for compatibility
  window.findItemInCarried = Utils.findItemInCarried;
  window.getItemFromPath = Utils.getItemFromPath;
  window.flattenItemsFromObject = Utils.flattenItemsFromObject;
});

// Register the /shop chat command properly
Hooks.on("chatCommandsReady", (chatCommands) => {
  chatCommands.registerCommand(
    chatCommands.createCommand({
      name: "shop",
      module: VendorWalletSystem.ID,
      description: "Abre a interface da loja GURPS Instant Bazaar.",
      icon: "fas fa-store",
      shouldDisplayToChat: false,
      handler: (message, args, chatData) => {
        if (game.user.isGM) {
          new window.GMToolsApplication().render(true);
        } else {
          window.VendorWalletSystem.openAllAvailableVendors();
        }
        return false;
      },
    })
  );
});