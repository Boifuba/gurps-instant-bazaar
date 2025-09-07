/**
 * @file Item drop handling for vendor purchases
 * @description Handles drag and drop operations for vendor item purchases
 */

import VendorWalletSystem from './main.js';

/**
 * Handles item drop events for vendor purchases on canvas
 * @param {Canvas} canvas - The canvas where the drop occurred
 * @param {Object|string} data - The drop data
 * @returns {Promise<boolean>} True to allow default behavior, false to prevent it
 */
export async function handleCanvasItemDrop(canvas, data) {
  // Handle case where data might be a string (from dataTransfer)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return true; // Let Foundry handle it normally
    }
  }
  
  if (data.type !== "Item") return true;

  const item = await fromUuid(data.uuid);
  if (!item) return true;

  // Get the target actor (if any)
  const targetToken = canvas.tokens.controlled[0];
  if (!targetToken || !targetToken.actor) return true;
  
  const actor = targetToken.actor;
  
  // Check if user has permission to modify this actor
  if (!actor.isOwner) return true;

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

    await VendorWalletSystem.transactionManager.currencyManager.processItemPurchase(actor, item, data.vendorId, data.vendorItemId, quantity);
    return false; // Prevent default item drop behavior
  } else {
    // Regular item drop, let Foundry handle it normally
    return true;
  }
}

/**
 * Initializes item drop handling by registering hooks
 * @returns {void}
 */
export function initializeItemDropHandling() {
  // Hook for handling item drops on canvas
  Hooks.on('dropCanvasData', handleCanvasItemDrop);
}