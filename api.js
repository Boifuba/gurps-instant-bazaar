/**
 * @file Public API for the GURPS Instant Bazaar module
 * @description Exposes module functionality in a safe, namespaced way following Foundry VTT best practices
 */

import VendorWalletSystem from './main.js';
import PlayerWalletApplication from './player-wallet-app.js';
import GMToolsApplication from './gm-tools-app.js';
import SellItemsApplication from './sell-items-app.js';
import VendorCreationApplication from './vendor-creation-app.js';
import VendorEditApplication from './vendor-edit-app.js';
import VendorItemEditApplication from './vendor-item-edit-app.js';
import CurrencySettingsApplication from './currency-settings-app.js';
import VendorDisplayApplication from './vendor-display-app.js';
import VendorManagerApplication from './vendor-manager-app.js';
import MoneyManagementApplication from './money-management-app.js';
import * as Utils from './utils.js';

/**
 * Public API object that will be exposed via game.modules.get('gurps-instant-bazaar').api
 * This provides a safe, namespaced way for other modules to interact with GURPS Instant Bazaar
 */
const publicApi = {
  // Main system controller
  system: VendorWalletSystem,
  
  // Application classes for external use
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
  },
  
  // Utility functions
  utils: {
    findItemInCarried: Utils.findItemInCarried,
    getItemFromPath: Utils.getItemFromPath,
    flattenItemsFromObject: Utils.flattenItemsFromObject,
  },
  
  // Convenience methods for common operations
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

export default publicApi;