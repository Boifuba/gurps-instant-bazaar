/**
 * @file Form utilities for vendor applications
 * @description Provides common form functionality for vendor creation and editing
 */

import VendorWalletSystem from './main.js';

/**
 * @class FormUtilities
 * @description Utility class containing common form functions for vendor applications
 */
export default class FormUtilities {
  /**
   * Handles file picker button clicks
   * @param {Event} event - The click event
   * @param {HTMLElement} element - The form element containing the file picker
   * @returns {Promise<void>}
   */
  static async handleFilePicker(event, element) {
    if (event.target.closest('.file-picker')) {
      event.preventDefault();
      const button = event.target.closest('.file-picker');
      const target = button.dataset.target;
      const type = button.dataset.type;
      
      const fp = new FilePicker({
        type: type,
        callback: (path) => {
          element.querySelector(`#${target}`).value = path;
        }
      });
      
      fp.render(true);
    }
  }

  /**
   * Validates stock range values
   * @param {number} stockMin - Minimum stock value
   * @param {number} stockMax - Maximum stock value
   * @returns {boolean} True if valid, false otherwise
   */
  static validateStockRange(stockMin, stockMax) {
    if (
      Number.isNaN(stockMin) ||
      Number.isNaN(stockMax) ||
      stockMin < 0 ||
      stockMax < 0 ||
      stockMin > stockMax
    ) {
      ui.notifications.error('Invalid stock range. Please ensure minimum and maximum are non-negative numbers and minimum is not greater than maximum.');
      return false;
    }
    return true;
  }

  /**
   * Validates price range values
   * @param {number} minValue - Minimum price value
   * @param {number} maxValue - Maximum price value
   * @returns {boolean} True if valid, false otherwise
   */
  static validatePriceRange(minValue, maxValue) {
    if (minValue > maxValue) {
      ui.notifications.error('Min Value must be less than or equal to Max Value');
      return false;
    }
    return true;
  }

  /**
   * Parses TL filter string into array
   * @param {string} tlFilterRaw - Raw TL filter string
   * @returns {Array|null} Parsed TL filter array or null
   */
  static parseTLFilter(tlFilterRaw) {
    const trimmed = tlFilterRaw?.trim();
    return trimmed
      ? trimmed
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : null;
  }

  /**
   * Parses LC filter value
   * @param {string} lcFilterValue - Raw LC filter value
   * @returns {number|null} Parsed LC filter value or null
   */
  static parseLCFilter(lcFilterValue) {
    return lcFilterValue === '' ? null : parseInt(lcFilterValue, 10);
  }

  /**
   * Generates random items for a vendor based on the provided criteria
   * @param {Object} vendorData - The vendor configuration data
   * @returns {Promise<Array>} Array of generated vendor items
   */
  static async generateRandomItems(vendorData) {
    const pack = game.packs.get(vendorData.compendium);
    if (!pack) return [];

    const index = await pack.getIndex({ fields: ['name', 'img', 'system.eqt.techlevel', 'system.eqt.legalityclass'] });
    let filteredItems = Array.from(index);

    // Apply TL filter if specified
    if (vendorData.tlFilter) {
      if (game.settings.get(VendorWalletSystem.ID, 'debugMode')) {
        console.log(`Applying TL filter [${vendorData.tlFilter.join(', ')}] to ${filteredItems.length} items`);
        filteredItems.forEach(item => {
          if (item.system?.eqt?.techlevel === undefined) {
            console.log(`Item sem TL: ${item.name}`);
          }
          if (item.system?.eqt?.legalityclass === undefined) {
            console.log(`Item sem LC: ${item.name}`);
          }
        });
      }
      filteredItems = filteredItems.filter(item => {
        const tl = item.system?.eqt?.techlevel ?? '';

        return vendorData.tlFilter.includes(String(tl).toLowerCase());

      });
      if (game.settings.get(VendorWalletSystem.ID, 'debugMode')) {
        console.log(`Items after TL filter: ${filteredItems.length}`);
      }
    }

    // Apply LC filter if specified
    if (vendorData.lcFilter != null) {

      if (game.settings.get(VendorWalletSystem.ID, 'debugMode')) {
        console.log(`Applying LC filter ≥ ${vendorData.lcFilter} to ${filteredItems.length} items`);
      }

      filteredItems = filteredItems.filter(item => {
        const lcValue = item.system?.eqt?.legalityclass;
        const lc = lcValue === undefined || lcValue === '' ? null : parseInt(lcValue, 10);
        const isIncluded = lc === null || lc >= vendorData.lcFilter;
        if (game.settings.get(VendorWalletSystem.ID, 'debugMode')) {
          console.log(`LC check for "${item.name}": ${lc} -> ${isIncluded ? 'kept' : 'discarded'}`);
        }
        return isIncluded;

      });
      if (game.settings.get(VendorWalletSystem.ID, 'debugMode')) {
        console.log(`Items after LC filter: ${filteredItems.length} items`);
      }
    }

    // Randomly select items
    const shuffled = filteredItems.sort(() => 0.5 - Math.random());
    const selectedItems = shuffled.slice(0, vendorData.quantity);

    const items = [];
    for (const indexItem of selectedItems) {
      const item = await pack.getDocument(indexItem._id);
      const minStock = Number.isInteger(vendorData.stockMin) ? vendorData.stockMin : 1;
      const maxStock = Number.isInteger(vendorData.stockMax) ? vendorData.stockMax : minStock;
      const quantity = Math.floor(Math.random() * (maxStock - minStock + 1)) + minStock;

      const price = item.system?.eqt?.cost || item.system?.cost || 0;

      items.push({
        id: foundry.utils.randomID(),
        name: item.name,
        price,
        link: item.link,
        img: item.img,
        weight: item.system?.eqt?.weight || item.system?.weight || 0,
        pageref: item.system?.eqt?.pageref || item.system?.pageref || '',
        uuid: item.uuid,

        quantity

      });
    }

    return items;
  }
}