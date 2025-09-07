/**
 * @file Form utilities for vendor applications
 * @description Provides common form functionality for vendor creation and editing
 */

/**
 * @class FormUtilities
 * @description Utility class containing common form functions for vendor applications
 */
class FormUtilities {
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
   * Sets up listeners for currency input fields to format values
   * @param {HTMLElement} element - The form element containing currency fields
   * @returns {void}
   */
  static setupCurrencyListeners(element) {
    const fields = element.querySelectorAll('#minValue, #maxValue');
    fields.forEach(field => {
      field.addEventListener('focus', e => {
        e.target.value = e.target.value.replace(/[^0-9.-]+/g, '');
      });
      field.addEventListener('blur', e => {
        const value = parseFloat(e.target.value.replace(/[^0-9.-]+/g, '')) || 0;
        e.target.value = VendorWalletSystem.formatCurrency(value);
      });
      const value = parseFloat(field.value.replace(/[^0-9.-]+/g, '')) || 0;
      field.value = VendorWalletSystem.formatCurrency(value);
    });
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
}

// Expose the utility class globally
window.FormUtilities = FormUtilities;