/**
 * @file Socket event constants for the  Instant Bazaar module
 * @description Centralized constants for socket event types to ensure consistency and reduce typos
 */

/**
 * Socket event types used throughout the module
 * @readonly
 * @enum {string}
 */
export const SOCKET_EVENTS = {
  // Vendor-related events
  VENDOR_UPDATED: 'vendorUpdated',
  VENDOR_DELETED: 'vendorDeleted',
  
  // Purchase-related events
  ITEM_PURCHASED: 'itemPurchased',
  PLAYER_PURCHASE_REQUEST: 'playerPurchaseRequest',
  PURCHASE_COMPLETED: 'purchaseCompleted',
  PURCHASE_FAILED: 'purchaseFailed',
  
  // Sell-related events
  PLAYER_SELL_REQUEST: 'playerSellRequest',
  SELL_COMPLETED: 'sellCompleted',
  SELL_FAILED: 'sellFailed'
};