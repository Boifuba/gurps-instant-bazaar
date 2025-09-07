/**
 * @class PlayerWalletApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for displaying player wallet and available vendors
 */
class PlayerWalletApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
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
    this._boundOnClickVendor = this._onClickVendor.bind(this);
    this._boundOnBackToVendors = this._onBackToVendors.bind(this);
    this._socketRegistered = false;
  }

  static DEFAULT_OPTIONS = {
    id: 'player-wallet',
    // The template's root element is a <div>; ensure the tag matches to prevent layout issues
    tag: 'div',
    window: {
      title: 'GURPS Instant Bazaar',
      icon: 'fas fa-wallet'
    },
    position: {
      width: 500
    },
    classes: ['gurps-instant-bazaar'],
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/player-wallet.hbs'
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
   * @returns {Promise<Object>} Context object containing vendor(s), wallet, and user data
   */
  async _prepareContext() {
    const wallet = VendorWalletSystem.getUserWallet(game.user.id);
    const useModuleCurrency = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
    
    // Get coin breakdown for display
    let coinBreakdown;
    if (useModuleCurrency) {
      coinBreakdown = VendorWalletSystem.getModuleCurrencyBreakdown(game.user.id);
    } else {
      // Get character sheet currency breakdown
      coinBreakdown = VendorWalletSystem.currencyManager._getCharacterSheetCoinBreakdown(game.user.id);
    }

    // Ensure coinBreakdown is always an array
    if (!Array.isArray(coinBreakdown)) {
      coinBreakdown = [];
    }

    // Check if we're displaying a specific vendor or all vendors
    if (this.vendorId) {
      const vendor = VendorWalletSystem.getVendor(this.vendorId);
      
      // If vendor doesn't exist, fall back to showing all vendors
      if (!vendor) {
        console.warn(`Vendor ${this.vendorId} not found, showing all vendors`);
        this.vendorId = null;
        return this._prepareAllVendorsContext(wallet, useModuleCurrency, coinBreakdown);
      }
      
      return this._prepareSingleVendorContext(vendor, wallet, useModuleCurrency, coinBreakdown);
    } else {
      return this._prepareAllVendorsContext(wallet, useModuleCurrency, coinBreakdown);
    }
  }

  /**
   * Prepares context for displaying a single vendor's items
   * @param {Object} vendor - The vendor data
   * @param {number} wallet - The user's wallet amount
   * @param {boolean} useModuleCurrency - Whether module currency is enabled
   * @param {Array} coinBreakdown - The coin breakdown array
   * @returns {Object} Context object for single vendor display
   */
  _prepareSingleVendorContext(vendor, wallet, useModuleCurrency, coinBreakdown) {
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
      isVendorSelected: true,
      vendor: filteredVendor,
      wallet,
      useModuleCurrency,
      coinBreakdown,
      isGM: game.user.isGM,
      searchTerm: this.searchTerm
    };
  }

  /**
   * Prepares context for displaying all available vendors
   * @param {number} wallet - The user's wallet amount
   * @param {boolean} useModuleCurrency - Whether module currency is enabled
   * @param {Array} coinBreakdown - The coin breakdown array
   * @returns {Object} Context object for all vendors display
   */
  _prepareAllVendorsContext(wallet, useModuleCurrency, coinBreakdown) {
    const allVendors = VendorWalletSystem.getVendors();
    const activeVendors = Object.entries(allVendors)
      .filter(([id, vendor]) => vendor.active !== false)
      .map(([id, vendor]) => ({
        id,
        name: vendor.name,
        image: vendor.image,
        itemCount: vendor.items ? vendor.items.length : 0
      }));

    return {
      isVendorSelected: false,
      vendors: activeVendors,
      wallet,
      useModuleCurrency,
      coinBreakdown,
      isGM: game.user.isGM
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {Promise<void>}
   */
  async _onRender() {
    // Clean up any existing listeners first
    this._cleanupListeners();
    
    // Update window title based on current view
    this._updateWindowTitle();
    
    // Register socket listener for purchase results once
    if (!this._socketRegistered) {
      game.socket.on(VendorWalletSystem.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = true;
    }

    // Check if we're displaying a specific vendor or all vendors
    if (this.vendorId) {
      // Single vendor display - add item-specific listeners
      if (game.user.isGM) {
        this.element.addEventListener('click', this._boundOnClickEditItem);
      } else {
        // Add purchase system for players
        this.element.addEventListener('change', this._boundOnItemSelection);
        this.element.addEventListener('click', this._boundOnPurchaseAction);
      }

      // Add search functionality for single vendor view
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

      // Add back to vendors button listener
      const backButton = this.element.querySelector('.back-to-vendors');
      if (backButton) {
        backButton.addEventListener('click', this._boundOnBackToVendors);
      }

      // Update clear button visibility
      this._updateClearButtonVisibility();
    } else {
      // All vendors display - add vendor selection listeners
      this.element.addEventListener('click', this._boundOnClickVendor);
    }
  }

  /**
   * Updates the window title based on current view
   */
  _updateWindowTitle() {
    if (this.vendorId) {
      const vendor = VendorWalletSystem.getVendor(this.vendorId);
      if (vendor) {
        // Update the window title to show vendor name
        const titleElement = this.element.closest('.window-app')?.querySelector('.window-title');
        if (titleElement) {
          titleElement.textContent = vendor.name;
        }
        // Also update the options for future renders
        this.options.window.title = vendor.name;
      }
    } else {
      // Reset to default title
      const titleElement = this.element.closest('.window-app')?.querySelector('.window-title');
      if (titleElement) {
        titleElement.textContent = 'GURPS Instant Bazaar';
      }
      this.options.window.title = 'GURPS Instant Bazaar';
    }
  }

  /**
   * Handles back to vendors button click
   * @param {Event} event - The click event
   */
  _onBackToVendors(event) {
    event.preventDefault();
    this.vendorId = null;
    this.searchTerm = '';
    this.render();
  }

  /**
   * Cleans up event listeners to prevent duplicates
   */
  _cleanupListeners() {
    if (this.element) {
      this.element.removeEventListener('click', this._boundOnClickEditItem);
      this.element.removeEventListener('change', this._boundOnItemSelection);
      this.element.removeEventListener('click', this._boundOnPurchaseAction);
      this.element.removeEventListener('click', this._boundOnClickVendor);
      
      const searchInput = this.element.querySelector('#itemSearch');
      if (searchInput) {
        searchInput.removeEventListener('input', this._boundOnSearchInput);
      }

      const backButton = this.element.querySelector('.back-to-vendors');
      if (backButton) {
        backButton.removeEventListener('click', this._boundOnBackToVendors);
      }
      
      // Clear any pending search timeout
      clearTimeout(this._searchTimeout);
    }
  }

  /**
   * Handles vendor selection clicks when displaying all vendors
   * @param {Event} event - The click event
   */
  _onClickVendor(event) {
    const vendorButton = event.target.closest('[data-vendor-id]');
    if (!vendorButton) return;
    
    const vendorId = vendorButton.dataset.vendorId;
    if (vendorId) {
      this.vendorId = vendorId;
      this.searchTerm = ''; // Reset search when switching vendors
      this.render();
    }
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
    
    console.log('💰 DEBUG: Socket event received:', data.type, data);
    
    switch (data.type) {
      case 'purchaseCompleted':
        ui.notifications.info(data.message);
        console.log('💰 DEBUG: Purchase completed, refreshing wallet display');
        // Check if element still exists before clearing selection
        if (this.element) {
          this._clearSelection();
          // Force a complete re-render to update wallet display
          setTimeout(() => {
            this.render(true);
          }, 100);
        }
        break;
      case 'purchaseFailed':
        ui.notifications.warn(data.message);
        console.log('💰 DEBUG: Purchase failed:', data.message);
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
    this.element.querySelector('#totalPrice').textContent = VendorWalletSystem.currencyManager.formatCurrency(totalPrice);

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
   * Processes the purchase of selected items
   * @param {Array<HTMLElement>} checkboxesParam - The selected checkboxes
   * @returns {Promise<void>}
   */
  async _purchaseSelectedItems(checkboxesParam) {
    this._updatePurchaseDisplay();
    const checkboxes = checkboxesParam || this.element.querySelectorAll('.item-checkbox:checked');
    if (checkboxes.length === 0) return;

    // Validate quantities
    for (const checkbox of checkboxes) {
      const itemId = checkbox.dataset.itemId;
      const quantityInput = this.element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
      const max = parseInt(quantityInput?.max);
      const quantity = parseInt(quantityInput?.value);
      if (!quantityInput || isNaN(quantity) || quantity < 1 || (!isNaN(max) && quantity > max)) {
        ui.notifications.warn('Invalid quantity selected.');
        return;
      }
    }

    // If user is GM, process directly
    if (game.user.isGM) {
      return this._purchaseSelectedItemsDirectly(checkboxes);
    }

    // For players, send request to GM via socket
    return this._sendPurchaseRequestToGM(checkboxes);
  }
  
  /**
   * Sends a purchase request to the GM via socket
   * @param {Array<HTMLElement>} checkboxes - The selected checkboxes
   * @returns {Promise<void>}
   */
  async _sendPurchaseRequestToGM(checkboxes) {
    console.log("💰 PLAYER: Sending purchase request to GM...");
    
    // Select target actor using centralized logic
    const targetActor = await VendorWalletSystem.selectUserActor();
    
    if (!targetActor) return;
    console.log("💰 PLAYER: Target actor selected:", targetActor.name);
    
    // Collect selected items data
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    const selectedItems = [];
    
    for (const checkbox of checkboxes) {
      const itemId = checkbox.dataset.itemId;
      const quantityInput = this.element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
      const quantity = parseInt(quantityInput?.value) || 1;
      const vendorItem = vendor.items.find(item => item.id === itemId);
      if (vendorItem) {
        selectedItems.push({
          id: vendorItem.id,
          name: vendorItem.name,
          price: vendorItem.price,
          uuid: vendorItem.uuid,
          quantity: quantity
        });
      }
    }
    
    console.log("💰 PLAYER: Selected items for purchase:", selectedItems);
    
    // Log the full names of selected items
    for (const item of selectedItems) {
      const itemDoc = await fromUuid(item.uuid);
      console.log(`💰 PLAYER SELECTED: ${item.quantity}x "${itemDoc?.name || 'Unknown item'}" (UUID: ${item.uuid})`);
    }
    
    // Send purchase request to GM
    console.log("💰 PLAYER: Emitting socket event...");
    game.socket.emit(VendorWalletSystem.SOCKET, {
      type: 'playerPurchaseRequest',
      userId: game.user.id,
      actorId: targetActor.id,
      vendorId: this.vendorId,
      selectedItems: selectedItems
    });
    
    ui.notifications.info('Purchase request sent to GM for processing...');
  }
  
  /**
   * Processes selected items directly (for GM users)
   * @param {Array<HTMLElement>} checkboxesParam - The selected checkboxes
   * @returns {Promise<void>}
   */
  async _purchaseSelectedItemsDirectly(checkboxesParam) {
    console.log("💰 GM: Processing direct purchase...");
    const checkboxes = Array.from(
      checkboxesParam || this.element.querySelectorAll('.item-checkbox:checked')
    );
    
    // Select target actor using centralized logic
    const targetActor = await VendorWalletSystem.selectUserActor();
    
    if (!targetActor) return;
    console.log("💰 GM: Target actor selected:", targetActor.name);
    
    // Gather items with sufficient stock
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    const itemsToProcess = [];
    
    for (const checkbox of checkboxes) {
      const itemId = checkbox.dataset.itemId;
      const quantityInput = this.element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
      const purchaseQuantity = parseInt(quantityInput?.value, 10);
      const vendorItem = vendor.items.find(item => item.id === itemId);
      const stock = vendorItem?.quantity;

      if (!vendorItem || isNaN(purchaseQuantity) || purchaseQuantity < 1 || (stock !== undefined && purchaseQuantity > stock)) {
        ui.notifications.warn(`${vendorItem?.name || 'Item'} is out of stock.`);
        continue;
      }

      itemsToProcess.push({ checkbox, vendorItem, purchaseQuantity, itemId: vendorItem.id });
    }

    if (itemsToProcess.length === 0) return;

    // Calculate total cost of attempted purchases
    const totalCostRequired = itemsToProcess.reduce((sum, { vendorItem, purchaseQuantity }) =>
      sum + (vendorItem.price * purchaseQuantity), 0);
    const roundedTotalCostRequired = Math.ceil(totalCostRequired);

    // Check wallet
    const currentWallet = VendorWalletSystem.getUserWallet(game.user.id);
    if (currentWallet < roundedTotalCostRequired) {
      ui.notifications.warn(`Not enough coins! Need ${VendorWalletSystem.currencyManager.formatCurrency(roundedTotalCostRequired)} but only have ${VendorWalletSystem.currencyManager.formatCurrency(currentWallet)}.`);
      return;
    }

    // Process each selected item
    let totalItemsProcessed = 0;
    let totalCostProcessed = 0;

    console.log("💰 GM: Processing selected items...");
    for (const { vendorItem, purchaseQuantity, itemId } of itemsToProcess) {
      console.log("💰 GM: Processing vendor item:", vendorItem.name, "Quantity:", purchaseQuantity);
      const success = await VendorWalletSystem.addItemToActor(targetActor, vendorItem.uuid, purchaseQuantity);
      
      if (!success) {
        ui.notifications.error(`Failed to add ${vendorItem.name} to ${targetActor.name}.`);
        continue;
      }

      totalItemsProcessed += purchaseQuantity;
      totalCostProcessed += vendorItem.price * purchaseQuantity;
      
      // Remove purchased quantity from vendor
      const currentStock = vendorItem.quantity ?? 0;
      await VendorWalletSystem.updateItemQuantityInVendor(this.vendorId, vendorItem.id, -purchaseQuantity);

      // Update displayed stock
      const newStock = currentStock - purchaseQuantity;
      vendorItem.quantity = newStock;
      const itemCard = this.element.querySelector(`.vendor-item-card[data-vendor-item-id="${itemId}"]`);
      const stockEl = itemCard?.querySelector('.item-stock');
      if (stockEl) stockEl.textContent = `(${newStock} available)`;
      const qtyInput = itemCard?.querySelector('.item-quantity-input');
      if (qtyInput) qtyInput.max = newStock;
    }

    // Round up the final cost processed
    totalCostProcessed = Math.ceil(totalCostProcessed);

    // Deduct money from wallet
    await VendorWalletSystem.setUserWallet(game.user.id, currentWallet - totalCostProcessed);

    ui.notifications.info(`Purchased ${totalItemsProcessed} items for ${VendorWalletSystem.currencyManager.formatCurrency(totalCostProcessed)}!`);

    // Clear selection and refresh
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
    // Clean up listeners
    this._cleanupListeners();
    
    if (this._socketRegistered) {
      game.socket.off(VendorWalletSystem.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = false;
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

// Expose the application to the global scope so other scripts can access it
globalThis.PlayerWalletApplication = PlayerWalletApplication;