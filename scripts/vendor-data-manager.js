/**
 * @file Vendor data manager for handling vendor CRUD operations
 * @description Manages vendor data storage, retrieval, and updates
 */

import { SOCKET_EVENTS } from './socket-events.js';

/**
 * @class VendorDataManager
 * @description Handles all vendor data operations
 */
export default class VendorDataManager {
  /**
   * @param {string} moduleId - The module identifier
   * @param {string} socketId - The socket identifier for communication
   */
  constructor(moduleId, socketId) {
    this.moduleId = moduleId;
    this.socketId = socketId;
  }

  /**
   * Gets all vendors from settings
   * @returns {Object} Object containing all vendors
   */
  getVendors() {
    try {
      return game.settings.get(this.moduleId, 'vendors') || {};
    } catch (error) {
      console.error('Error getting vendors:', error);
      return {};
    }
  }

  /**
   * Gets a specific vendor by ID
   * @param {string} vendorId - The vendor ID
   * @returns {Object|undefined} The vendor object or undefined if not found
   */
  getVendor(vendorId) {
    const vendors = this.getVendors();
    return vendors[vendorId];
  }

  /**
   * Updates a vendor's data
   * @param {string} vendorId - The vendor ID
   * @param {Object} vendorData - The updated vendor data
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async updateVendor(vendorId, vendorData) {
    try {
      const vendors = this.getVendors();
      vendors[vendorId] = vendorData;
      await game.settings.set(this.moduleId, 'vendors', vendors);
      
      // Emit socket event for real-time updates
      game.socket.emit(this.socketId, {
        type: SOCKET_EVENTS.VENDOR_UPDATED,
        vendorId: vendorId
      });
      
      return true;
    } catch (error) {
      console.error('Error updating vendor:', error);
      return false;
    }
  }

  /**
   * Deletes a vendor
   * @param {string} vendorId - The vendor ID
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async deleteVendor(vendorId) {
    try {
      const vendors = this.getVendors();
      delete vendors[vendorId];
      await game.settings.set(this.moduleId, 'vendors', vendors);
      
      // Emit socket event for real-time updates
      game.socket.emit(this.socketId, {
        type: SOCKET_EVENTS.VENDOR_DELETED,
        vendorId: vendorId
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting vendor:', error);
      return false;
    }
  }

  /**
   * Updates item quantity in a vendor's inventory
   * @param {string} vendorId - The vendor ID
   * @param {string} vendorItemId - The vendor item ID
   * @param {number} change - The quantity change (positive or negative)
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async updateItemQuantityInVendor(vendorId, vendorItemId, change) {
    try {
      const vendor = this.getVendor(vendorId);
      if (!vendor) return false;

      const itemIndex = vendor.items.findIndex(item => item.id === vendorItemId);
      if (itemIndex === -1) return false;

      const item = vendor.items[itemIndex];
      const currentQuantity = item.quantity || 1;
      const newQuantity = Math.max(0, currentQuantity + change);

      if (newQuantity <= 0) {
        // Remove item if quantity reaches 0
        vendor.items = vendor.items.filter(item => item.id !== vendorItemId);
      } else {
        // Update quantity
        vendor.items[itemIndex].quantity = newQuantity;
      }

      await this.updateVendor(vendorId, vendor);
      
      // Emit socket event for item purchase
      game.socket.emit(this.socketId, {
        type: SOCKET_EVENTS.ITEM_PURCHASED,
        vendorId: vendorId,
        itemId: vendorItemId
      });
      
      return true;
    } catch (error) {
      console.error('Error updating item quantity:', error);
      return false;
    }
  }

  /**
   * Finds a vendor that contains an item with the specified UUID
   * @param {string} itemUuid - The item UUID to search for
   * @returns {Object|null} Object with vendor and item data, or null if not found
   */
  findVendorByItemUuid(itemUuid) {
    const vendors = this.getVendors();
    
    for (const [vendorId, vendor] of Object.entries(vendors)) {
      if (!vendor.items) continue;
      
      const item = vendor.items.find(item => item.uuid === itemUuid);
      if (item) {
        return {
          vendor: vendor,
          vendorId: vendorId,
          item: item
        };
      }
    }
    
    return null;
  }
}