/**
 * @file Main module file for the Vendor Wallet System
 * @description Provides core functionality for managing vendors, player wallets, and item transactions in FoundryVTT
 */

/** Import dependencies */
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
import { SOCKET_EVENTS } from './socket-events.js';
import PurchaseApprovalDialog from './purchase-approval-dialog-app.js';
import SellApprovalDialog from './sell-approval-dialog-app.js';


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

  /** Static getters for centralized settings access */
  static getUseModuleCurrencySystem() {
    return game.settings.get(this.ID, 'useModuleCurrencySystem');
  }

  static getCurrencyDenominations() {
    return game.settings.get(this.ID, 'currencyDenominations') || [];
  }

  static getCurrencySymbol() {
    return game.settings.get(this.ID, 'currencySymbol') || '$';
  }

  static getRequireGMApproval() {
    return game.settings.get(this.ID, 'requireGMApproval');
  }

  static getAutomaticSellPercentage() {
    return game.settings.get(this.ID, 'automaticSellPercentage');
  }

  static getDebugMode() {
    return game.settings.get(this.ID, 'debugMode');
  }

  /**
   * Initializes the module by registering settings, socket listeners, and handlebars helpers
   * @returns {void}
   */
  static initialize() {
    registerModuleSettings(this.ID);
    this.registerSocketListeners();
    
    /** Initialize currency manager with settings */
    const currencySettings = {
      useModuleCurrencySystem: game.settings.get(this.ID, 'useModuleCurrencySystem'),
      currencyDenominations: game.settings.get(this.ID, 'currencyDenominations'),
      currencySymbol: game.settings.get(this.ID, 'currencySymbol')
    };
    this.currencyManager = new CurrencyManager(this.ID, currencySettings);
    
    /** Initialize vendor data manager */
    this.vendorDataManager = new VendorDataManager(this.ID, this.SOCKET);
    
    /** Initialize transaction manager */
    this.transactionManager = new TransactionManager(this.ID, this.SOCKET, this.currencyManager, this.vendorDataManager);
    
    if (typeof Handlebars !== 'undefined') {
      /** Register the formatCurrency helper to ensure it's always available */
      Handlebars.registerHelper('formatCurrency', (amount) => {
        return this.currencyManager.formatCurrency(amount);
      });
      Handlebars.registerHelper('join', (arr, sep) => Array.isArray(arr) ? arr.join(sep) : '');
    }
    
    /** Expose public API immediately after initialization */
    this.exposePublicAPI();
  }

  /**
   * Exposes the public API for external access
   * @returns {void}
   */
  static exposePublicAPI() {
    const publicApi = {
      // Main system controller
      system: VendorWalletSystem,
      
      /** Application classes for external use */
      applications: {
        PlayerWalletApplication,
        GMToolsApplication,
        SellItemsApplication,
        VendorCreationApplication,
        VendorEditApplication,
        VendorItemEditApplication,
        CurrencySettingsApplication,
        VendorDisplayApplication,
        VendorManagerApplication,
        MoneyManagementApplication,
        PurchaseApprovalDialog,
        SellApprovalDialog,
      },
      
      /** Utility functions */
      utils: {
        findItemInCarried: Utils.findItemInCarried,
        getItemFromPath: Utils.getItemFromPath,
        flattenItemsFromObject: Utils.flattenItemsFromObject,
      },
      
      /** Convenience methods for common operations */
      formatCurrency: (amount) => VendorWalletSystem.formatCurrency(amount),
      parseCurrency: (value) => VendorWalletSystem.parseCurrency(value),
      getVendors: () => VendorWalletSystem.getVendors(),
      getVendor: (vendorId) => VendorWalletSystem.getVendor(vendorId),
      updateVendor: (vendorId, vendorData) => VendorWalletSystem.updateVendor(vendorId, vendorData),
      deleteVendor: (vendorId) => VendorWalletSystem.deleteVendor(vendorId),
      updateItemQuantityInVendor: (vendorId, vendorItemId, change) => VendorWalletSystem.updateItemQuantityInVendor(vendorId, vendorItemId, change),
      findVendorByItemUuid: (itemUuid) => VendorWalletSystem.findVendorByItemUuid(itemUuid),
      openAllAvailableVendors: () => VendorWalletSystem.openAllAvailableVendors(),
      initializeMissingActorCoins: () => VendorWalletSystem.initializeMissingActorCoins(),
      refreshCurrencySettings: () => VendorWalletSystem.refreshCurrencySettings(),
    };
    
    /** Expose API following Foundry VTT best practices */
    game.modules.get(VendorWalletSystem.ID).api = publicApi;
    
    /** Also make it globally accessible for convenience */
    globalThis.VendorWalletSystem = VendorWalletSystem;
  }

  /**
   * Registers socket event listeners for real-time communication
   * @returns {void}
   */
  static registerSocketListeners() {
    game.socket.on(this.SOCKET, this.handleSocketEvent.bind(this));
  }

  /** Convenience methods for accessing manager functionality */
  static formatCurrency(amount) { return this.currencyManager?.formatCurrency(amount) || '$0.00'; }
  static parseCurrency(value) { return this.currencyManager?.parseCurrency(value) || 0; }
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
      case SOCKET_EVENTS.VENDOR_UPDATED:
        VendorDisplayApplication?.refreshDisplays(data.vendorId);
        VendorManagerApplication?.refreshVendors();
        break;
      case SOCKET_EVENTS.ITEM_PURCHASED:
        VendorDisplayApplication?.refreshDisplays(data.vendorId);
        VendorManagerApplication?.refreshVendors();
        break;
      case SOCKET_EVENTS.PLAYER_PURCHASE_REQUEST:
        if (game.user.isGM) {
          this.transactionManager.processPlayerPurchaseRequest(data);
        }
        break;
      case SOCKET_EVENTS.PLAYER_SELL_REQUEST:
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
    /** Only GMs can reset actor coins */
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can initialize actor coins!');
      return;
    }

    /** Check if module currency system is enabled */
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

  /**
   * Refreshes currency manager settings when they change
   * @returns {void}
   */
  static async refreshCurrencySettings() {
    if (this.currencyManager) {
      const newSettings = {
        useModuleCurrencySystem: game.settings.get(this.ID, 'useModuleCurrencySystem'),
        currencyDenominations: game.settings.get(this.ID, 'currencyDenominations'),
        currencySymbol: game.settings.get(this.ID, 'currencySymbol')
      };
      await this.currencyManager.refreshSettings(newSettings);
    }
  }
}



/** Initialize the system when FoundryVTT is ready */
Hooks.once('init', () => {
  const UserClass = CONFIG.User?.documentClass ?? game?.user?.constructor;
  if (UserClass?.registerFlagScope) {
    UserClass.registerFlagScope(VendorWalletSystem.ID);
  } else {
    console.warn('User.registerFlagScope unavailable; wallet flags may fail.');
  }
  VendorWalletSystem.initialize();
  
  /** Initialize UI integrations */
  initializeUIIntegrations();
  
  /** Initialize item drop handling */
  initializeItemDropHandling();
});

/** /shop command without dependencies (Foundry v13 core) */
Hooks.on("chatMessage", (chatLog, message, chatData) => {
  const txt = String(message).trim();
  if (!/^\/shop(\s|$)/i.test(txt)) return; /** Not /shop → let it pass */

  /** Command action */
  if (game.user.isGM) {
    new GMToolsApplication().render(true);
  } else {
    VendorWalletSystem.openAllAvailableVendors();
  }

  return false; /** Block default processing and the message in chat */
});
Hooks.on("chatMessage", (chatLog, message, chatData) => {
  const txt = String(message).trim();
  if (!/^\/sell(\s|$)/i.test(txt)) return; /** Not /sell → let it pass */

  /** Command action */
  
  new SellItemsApplication().render(true); 

  return false; /** Block default processing and the message in chat */
});
