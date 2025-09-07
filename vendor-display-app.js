/**
 * @file Vendor display application for showing vendor items and handling purchases
 * @description Displays vendor items with purchase functionality for players and editing for GMs
 */

/**
 * @class VendorDisplayApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for displaying vendor items and handling purchases
 */
class VendorDisplayApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {Object} options - Application options
   * @param {string} options.vendorId - The ID of the vendor to display
   */
  constructor(options = {}) {
    super(options);
    this.vendorId = options.vendorId;
    this.searchTerm = '';

    // Bind event handlers for later removal
    this._boundOnSocketEvent = this._onSocketEvent.bind(this);
    this._boundOnClickEditItem = this._onClickEditItem.bind(this);
    this._boundOnItemSelection = this._onItemSelection.bind(this);
    this._boundOnPurchaseAction = this._onPurchaseAction.bind(this);
    this._boundOnSearchInput = this._onSearchInput.bind(this);
    this._socketRegistered = false;
  }

  static DEFAULT_OPTIONS = {
    id: 'vendor-display',
    // The template's root element is a <div>; ensure the tag matches to prevent layout issues
    tag: 'div',
    window: {
      title: 'Vendor Items',
      icon: 'fas fa-shopping-cart'
    },
    position: {
      width: 500
    },
    classes: ['gurps-instant-bazaar'],
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/vendor-display.hbs'
    }
  };

  /**
   * Ensure the application does not attempt to reposition if its element has
   * already been removed from the DOM. This avoids errors when the window is
   * closed before Foundry finishes rendering or measuring dimensions.
   * @param {...any} args - Position arguments
   * @returns {any} Result of setPosition or undefined if element is not in DOM
   */
  setPosition(...args) {
    if (!this.element || !document.body.contains(this.element)) return;
    return super.setPosition(...args);
  }

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing vendor, wallet, and user data
   */
  async _prepareContext() {
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    const wallet = VendorWalletSystem.currencyManager.getUserWallet(game.user.id);

    // Start with a shallow copy to avoid mutating the original vendor
    let filteredVendor = { ...vendor, items: [...(vendor.items || [])] };

    // Filter items based on search term
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filteredVendor.items = filteredVendor.items.filter(item =>
        item.name.toLowerCase().includes(searchLower)
      );
    }

    // Clone items without altering their prices
    filteredVendor.items = filteredVendor.items.map(item => ({
      ...item
    }));

    return {
      vendor: filteredVendor,
      wallet,
      isGM: game.user.isGM,
      searchTerm: this.searchTerm
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {Promise<void>}
   */
  async _onRender() {
    // Register socket listener for purchase results once
    if (!this._socketRegistered) {
      game.socket.on(VendorWalletSystem.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = true;
    }

    // Add click listener for edit buttons (GM only)
    if (game.user.isGM) {
      this.element.addEventListener('click', this._boundOnClickEditItem);
    } else {
      // Add purchase system for players
      this.element.addEventListener('change', this._boundOnItemSelection);
      this.element.addEventListener('click', this._boundOnPurchaseAction);
    }

    // Add search functionality for all users
    const searchInput = this.element.querySelector('#itemSearch');
    const clearSearchBtn = this.element.querySelector('#clearSearch');
    
    if (searchInput) {
      searchInput.addEventListener('input', this._boundOnSearchInput);
      // Maintain focus and cursor position after render
      if (this.searchTerm) {
        const cursorPos = searchInput.value.length;
        searchInput.focus();
        searchInput.setSelectionRange(cursorPos, cursorPos);
      }
    }
    
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        this.searchTerm = '';
        this.render();
      });
    }

    // Update clear button visibility
    this._updateClearButtonVisibility();
  }

  /**
   * Handles search input with debouncing
   * @param {Event} event - The input event
   */
  _onSearchInput(event) {
    // Clear any existing timeout
    clearTimeout(this._searchTimeout);
    
    // Set a new timeout to debounce the search
    this._searchTimeout = setTimeout(() => {
      this.searchTerm = event.target.value;
      this.render();
    }, 300);
  }

  /**
   * Updates the visibility of the clear search button
   */
  _updateClearButtonVisibility() {
    const clearSearchBtn = this.element.querySelector('#clearSearch');
    if (clearSearchBtn) {
      clearSearchBtn.style.display = this.searchTerm ? 'flex' : 'none';
    }
  }

  /**
   * Handles socket events from other clients
   * @param {Object} data - The socket event data
   */
  _onSocketEvent(data) {
    // Only handle events for this user
    if (data.userId !== game.user.id) return;
    
    switch (data.type) {
      case 'purchaseCompleted':
        ui.notifications.info(data.message);
        // Check if element still exists before clearing selection
        if (this.element) {
          this._clearSelection();
          this.render(); // Refresh the display
        }
        break;
      case 'purchaseFailed':
        ui.notifications.warn(data.message);
        break;
    }
  }

  /**
   * Handles item selection changes for purchase calculation
   * @param {Event} event - The change event
   */
  _onItemSelection(event) {
    if (!event.target.classList.contains('item-checkbox') && !event.target.classList.contains('item-quantity-input')) return;
    
    this._updatePurchaseDisplay();
  }

  /**
   * Handles purchase action button clicks
   * @param {Event} event - The click event
   */
  _onPurchaseAction(event) {
    const action = event.target.id;

    switch (action) {
      case 'purchaseSelected': {
        const vendor = VendorWalletSystem.getVendor(this.vendorId);
        const selected = Array.from(this.element.querySelectorAll('.item-checkbox:checked'));
        const validCheckboxes = [];

        for (const checkbox of selected) {
          const itemId = checkbox.dataset.itemId;
          const quantityInput = this.element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
          const quantity = parseInt(quantityInput?.value) || 1;
          const vendorItem = vendor.items.find(item => item.id === itemId);
          const stock = vendorItem?.quantity;

          if (stock !== undefined && quantity > stock) {
            ui.notifications.warn(`${vendorItem?.name || 'Item'} is out of stock.`);
            continue;
          }

          validCheckboxes.push(checkbox);
        }

        if (validCheckboxes.length > 0) {
          this._purchaseSelectedItems(validCheckboxes);
        }
        break;
      }
      case 'clearSelection':
        this._clearSelection();
        break;
    }
  }

  /**
   * Updates the purchase display with selected items count and total price
   */
  _updatePurchaseDisplay() {
    const checkboxes = this.element.querySelectorAll('.item-checkbox:checked');
    let selectedCount = 0;
    let totalPrice = 0;

    for (const checkbox of checkboxes) {
      const itemId = checkbox.dataset.itemId;
      const quantityInput = this.element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
      if (!quantityInput) continue;

      let quantity = parseInt(quantityInput.value) || 1;
      const max = parseInt(quantityInput.max);

      if (quantity < 1) quantity = 1;
      if (!isNaN(max) && quantity > max) quantity = max;

      quantityInput.value = quantity;

      const price = VendorWalletSystem.parseCurrency(checkbox.dataset.price) || 0;
      totalPrice += price * quantity;
      selectedCount += quantity;
    }

    // Round up the total price
    totalPrice = Math.ceil(totalPrice);

    this.element.querySelector('#selectedCount').textContent = selectedCount;
    this.element.querySelector('#totalPrice').textContent = VendorWalletSystem.formatCurrency(totalPrice);

    const purchaseButton = this.element.querySelector('#purchaseSelected');
    purchaseButton.disabled = selectedCount === 0;
  }

  /**
   * Clears all item selections
   */
  _clearSelection() {
    if (!this.element) return; // Safety check
    const checkboxes = this.element.querySelectorAll('.item-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    this._updatePurchaseDisplay();
  }

  /**
   * Processes the purchase of selected items using centralized logic
   * @param {Array<HTMLElement>} checkboxes - The selected checkboxes
   * @returns {Promise<void>}
   */
  async _purchaseSelectedItems(checkboxes) {
    await PlayerWalletApplication.processClientPurchase({
      vendorId: this.vendorId,
      checkboxes,
      element: this.element,
      userId: game.user.id
    });

    // Clear selection and refresh if successful
    if (this.element) {
      this._clearSelection();
      this.render();
    }
  }

  /**
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    if (this._socketRegistered) {
      game.socket.off(VendorWalletSystem.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = false;
    }

    if (this.element) {
      this.element.removeEventListener('click', this._boundOnClickEditItem);
      this.element.removeEventListener('change', this._boundOnItemSelection);
      this.element.removeEventListener('click', this._boundOnPurchaseAction);
      
      const searchInput = this.element.querySelector('#itemSearch');
      if (searchInput) {
        searchInput.removeEventListener('input', this._boundOnSearchInput);
      }
      
      // Clear any pending search timeout
      clearTimeout(this._searchTimeout);
    }

    return super.close(options);
  }

  /**
   * Handles edit item button clicks (GM only)
   * @param {Event} event - The click event
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
}

/**
 * Static method to refresh all vendor display windows for a specific vendor
 * @param {string} vendorId - The vendor ID to refresh displays for
 * @returns {void}
 */
VendorDisplayApplication.refreshDisplays = function(vendorId) {
  Object.values(ui.windows).forEach(window => {
    if (window instanceof VendorDisplayApplication && window.vendorId === vendorId) {
      window.render(false);
    }
  });
};

// Expose the application to the global scope so other scripts can access it
globalThis.VendorDisplayApplication = VendorDisplayApplication;