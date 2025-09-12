/**
 * @file Vendor display application for showing vendor items to players
 * @description Displays vendor inventory with purchase functionality
 */

import VendorWalletSystem from './main.js';
import VendorItemEditApplication from './vendor-item-edit-app.js';

/**
 * @class VendorDisplayApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for displaying vendor items to players
 */
export default class VendorDisplayApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.vendorId = options.vendorId;
    
    // Bind event handlers for later removal
    this._boundOnClickEditItem = this._onClickEditItem.bind(this);
  }

  static DEFAULT_OPTIONS = {
    id: 'vendor-display',
    tag: 'div',
    window: {
      title: 'Vendor',
      icon: 'fas fa-store'
    },
    position: {
      width: 500,
    },
    classes: ['gurps-instant-bazaar']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/templates/vendor-display.hbs'
    }
  };

  /**
   * Prevents position update errors when element is removed from DOM
   * @param {...any} args - Position arguments
   * @returns {any} Result of _updatePosition or undefined if element is not in DOM
   */
  _updatePosition(...args) {
    if (!this.element || !document.body.contains(this.element)) return;
    return super._updatePosition(...args);
  }

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing vendor and user data
   */
  async _prepareContext() {
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    if (!vendor) {
      return { error: 'Vendor not found' };
    }

    const wallet = VendorWalletSystem.currencyManager.getUserWallet(game.user.id);

    return {
      vendor,
      wallet,
      isGM: game.user.isGM
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    // Update window title with vendor name
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    if (vendor) {
      const titleElement = this.element.closest('.window-app')?.querySelector('.window-title');
      if (titleElement) {
        titleElement.textContent = vendor.name;
      }
    }

    if (game.user.isGM) {
      // Add edit functionality for GMs
      this.element.addEventListener('click', this._boundOnClickEditItem);
    } else {
      // Add purchase functionality for players
      this.element.addEventListener('click', this._onPurchaseItem.bind(this));
    }
  }

  /**
   * Handles edit item button clicks (GM only)
   * @param {Event} event - The click event
   * @returns {void}
   */
  _onClickEditItem(event) {
    if (event.target.closest('.edit-item-btn')) {
      event.preventDefault();
      const button = event.target.closest('.edit-item-btn');
      const itemId = button.dataset.itemId;
      
      new VendorItemEditApplication({ 
        vendorId: this.vendorId, 
        itemId: itemId 
      }).render(true);
    }
  }

  /**
   * Handles item purchase clicks
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onPurchaseItem(event) {
    const button = event.target.closest('[data-action="purchase"]');
    if (!button) return;

    const itemId = button.dataset.itemId;
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    const item = vendor?.items.find(i => i.id === itemId);
    
    if (!item) return;

    // Get quantity from user
    const quantity = await Dialog.prompt({
      title: `Purchase ${item.name}`,
      content: `
        <div class="form-group">
          <label>Quantity:</label>
          <input type="number" id="quantity" value="1" min="1" ${item.quantity !== undefined ? `max="${item.quantity}"` : ''}>
        </div>
        <div class="form-group">
          <label>Price per item:</label>
          <span>${VendorWalletSystem.formatCurrency(item.price)}</span>
        </div>
      `,
      callback: html => parseInt(html.find('#quantity').val()) || 1
    });

    if (!quantity || quantity < 1) return;

    // Process purchase using centralized logic
    const checkboxes = [{
      dataset: {
        itemId: item.id,
        price: item.price
      }
    }];

    // Create a mock element with quantity input
    const mockElement = document.createElement('div');
    const quantityInput = document.createElement('input');
    quantityInput.className = 'item-quantity-input';
    quantityInput.dataset.itemId = item.id;
    quantityInput.value = quantity;
    mockElement.appendChild(quantityInput);

    // Get the API from the module
    const api = game.modules.get('gurps-instant-bazaar').api;
    await api.applications.PlayerWalletApplication.processClientPurchase({
      vendorId: this.vendorId,
      checkboxes,
      element: mockElement,
      userId: game.user.id
    });

    // Refresh display
    this.render();
  }

  /**
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    // Clean up event listeners
    if (this.element && this._boundOnClickEditItem) {
      this.element.removeEventListener('click', this._boundOnClickEditItem);
    }
    
    return super.close(options);
  }

  /**
   * Static method to refresh all vendor displays for a specific vendor
   * @param {string} vendorId - The vendor ID to refresh displays for
   * @returns {void}
   */
  static refreshDisplays(vendorId) {
    Object.values(ui.windows).forEach(app => {
      if (app instanceof VendorDisplayApplication && app.vendorId === vendorId) {
        app.render(false);
      }
    });
  }
}