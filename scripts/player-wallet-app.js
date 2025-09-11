import VendorWalletSystem from './main.js';

import { getOwnedPlayerActors, getProcessedPlayerActorsData } from './utils.js';
import { SOCKET_EVENTS } from './socket-events.js';

/**
 * @class PlayerWalletApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for displaying player wallet and available vendors
 */
export default class PlayerWalletApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {Object} options - Application options
   * @param {string} options.vendorId - The ID of the vendor to display
   */
  constructor(options = {}) {
    super(options);
    this.vendorId = options.vendorId;
    this.searchTerm = '';
    this.selectedActorId = null;

    /** @description Bind event handlers for later removal */
    this._boundOnSocketEvent = this._onSocketEvent.bind(this);
    this._boundOnClickEditItem = this._onClickEditItem.bind(this);
    this._boundOnItemSelection = this._onItemSelection.bind(this);
    this._boundOnPurchaseAction = this._onPurchaseAction.bind(this);
    this._boundOnSearchInput = this._onSearchInput.bind(this);
    this._boundOnClickVendor = this._onClickVendor.bind(this);
    this._boundOnBackToVendors = this._onBackToVendors.bind(this);
    this._boundOnActorSelection = this._onActorSelection.bind(this);
    this._boundOnDocumentClick = this._onDocumentClick.bind(this);
    this._socketRegistered = false;
    this._documentClickListenerAdded = false;
  }

  static DEFAULT_OPTIONS = {
    id: 'player-wallet',
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
      template: 'modules/gurps-instant-bazaar/templates/player-wallet.hbs'
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
    /** @description Get processed actors data using the utility function */
    const actorsData = await getProcessedPlayerActorsData(this.selectedActorId);
    const { processedActors, selectedActor, selectedActorId, useModuleCurrency } = actorsData;
    
    /** @description Update the internal selectedActorId */
    this.selectedActorId = selectedActorId;

    /** @description Check if we're displaying a specific vendor or all vendors */
    if (this.vendorId) {
      const vendor = VendorWalletSystem.getVendor(this.vendorId);
      
      /** @description If vendor doesn't exist, fall back to showing all vendors */
      if (!vendor) {
        console.warn(`Vendor ${this.vendorId} not found, showing all vendors`);
        this.vendorId = null;
        return this._prepareAllVendorsContext(selectedActor, useModuleCurrency, processedActors);
      }
      
      return this._prepareSingleVendorContext(vendor, selectedActor, useModuleCurrency, processedActors);
    } else {
      return this._prepareAllVendorsContext(selectedActor, useModuleCurrency, processedActors);
    }
  }

  /**
   * Prepares context for displaying a single vendor's items
   * @param {Object} vendor - The vendor data
   * @param {Object} selectedActor - The selected actor data
   * @param {boolean} useModuleCurrency - Whether module currency is enabled
   * @param {Array} userActors - Array of user's actors
   * @returns {Object} Context object for single vendor display
   */
  _prepareSingleVendorContext(vendor, selectedActor, useModuleCurrency, userActors) {
    /** @description Start with a shallow copy to avoid mutating the original vendor */
    let filteredVendor = { ...vendor, items: [...(vendor.items || [])] };

    /** @description Filter items based on search term */
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filteredVendor.items = filteredVendor.items.filter(item =>
        item.name.toLowerCase().includes(searchLower)
      );
    }

    /** @description Clone items without altering their prices */
    filteredVendor.items = filteredVendor.items.map(item => ({
      ...item
    }));

    return {
      isVendorSelected: true,
      vendor: filteredVendor,
      selectedActor,
      selectedActorId: this.selectedActorId,
      useModuleCurrency,
      userActors,
      isGM: game.user.isGM,
      searchTerm: this.searchTerm
    };
  }

  /**
   * Prepares context for displaying all available vendors
   * @param {Object} selectedActor - The selected actor data
   * @param {boolean} useModuleCurrency - Whether module currency is enabled
   * @param {Array} userActors - Array of user's actors
   * @returns {Object} Context object for all vendors display
   */
  _prepareAllVendorsContext(selectedActor, useModuleCurrency, userActors) {
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
      selectedActor,
      selectedActorId: this.selectedActorId,
      useModuleCurrency,
      userActors,
      isGM: game.user.isGM
    };
  }

  /**
   * Handles document clicks to close dropdowns
   * @param {Event} e - The click event
   * @returns {void}
   */
  _onDocumentClick(e) {
    if (!this.element) return;
    
    const allDropdowns = this.element.querySelectorAll('.dropdown');
    allDropdowns.forEach(dropdown => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  /**
   * Handles actor selection changes
   * @param {Event} event - The change event
   * @returns {void}
   */
  _onActorSelection(event) {
    /** @description Handle radio button changes */
    if (event.target.name === 'selectedActor') {
      this.selectedActorId = event.target.value;
      this.render();
    }
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {Promise<void>}
   */
  async _onRender() {
    /** @description Clean up any existing listeners first */
    this._cleanupListeners();
    
    /** @description Update window title based on current view */
    this._updateWindowTitle();
    
    /** @description Register socket listener for purchase results once */
    if (!this._socketRegistered) {
      game.socket.on(VendorWalletSystem.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = true;
    }

    /** @description Add actor selection listeners for radio buttons */
    const actorRadios = this.element.querySelectorAll('input[name="selectedActor"]');
    actorRadios.forEach(radio => {
      radio.addEventListener('change', this._boundOnActorSelection);
    });

    /** @description Check if we're displaying a specific vendor or all vendors */
    if (this.vendorId) {
      /** @description Single vendor display - add item-specific listeners */
      if (game.user.isGM) {
        this.element.addEventListener('click', this._boundOnClickEditItem);
      } else {
        /** @description Add purchase system for players */
        this.element.addEventListener('change', this._boundOnItemSelection);
        this.element.addEventListener('click', this._boundOnPurchaseAction);
      }

      /** @description Add search functionality for single vendor view */
      const searchInput = this.element.querySelector('#itemSearch');
      const clearSearchBtn = this.element.querySelector('#clearSearch');
      
      if (searchInput) {
        searchInput.addEventListener('input', this._boundOnSearchInput);
        /** @description Maintain focus and cursor position after render */
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

      /** @description Add back to vendors button listener */
      const backButton = this.element.querySelector('.back-to-vendors');
      if (backButton) {
        backButton.addEventListener('click', this._boundOnBackToVendors);
      }

      /** @description Update clear button visibility */
      this._updateClearButtonVisibility();
    } else {
      /** @description All vendors display - add vendor selection listeners */
      this.element.addEventListener('click', this._boundOnClickVendor);
    }
  }

  /**
   * Sets up dropdown functionality
   * @param {string} [dropdownSelector] - Optional selector for specific dropdown
   * @returns {void}
   */
  _setupDropdown(dropdownSelector) {
    let dropdownToggle, dropdown;
    
    if (dropdownSelector) {
      dropdown = this.element.querySelector(dropdownSelector);
      dropdownToggle = dropdown?.querySelector('.dropdown-toggle');
    } else {
      dropdownToggle = this.element.querySelector('.dropdown-toggle');
      dropdown = this.element.querySelector('.dropdown');
    }
    
    if (dropdownToggle && dropdown) {
      dropdownToggle.addEventListener('click', (e) => {
        e.preventDefault();
        
        /** @description Close other dropdowns */
        const allDropdowns = this.element.querySelectorAll('.dropdown');
        allDropdowns.forEach(otherDropdown => {
          if (otherDropdown !== dropdown) {
            otherDropdown.classList.remove('open');
          }
        });
        
        dropdown.classList.toggle('open');
      });
      
      /** @description Add document click listener only once */
      if (!this._documentClickListenerAdded) {
        document.addEventListener('click', this._boundOnDocumentClick);
        this._documentClickListenerAdded = true;
      }
    }
  }

  /**
   * Updates the window title based on current view
   * @returns {void}
   */
  _updateWindowTitle() {
    if (this.vendorId) {
      const vendor = VendorWalletSystem.getVendor(this.vendorId);
      if (vendor) {
        /** @description Update the window title to show vendor name */
        const titleElement = this.element.closest('.window-app')?.querySelector('.window-title');
        if (titleElement) {
          titleElement.textContent = vendor.name;
        }
        /** @description Also update the options for future renders */
        this.options.window.title = vendor.name;
      }
    } else {
      /** @description Reset to default title */
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
   * @returns {void}
   */
  _onBackToVendors(event) {
    event.preventDefault();
    this.vendorId = null;
    this.searchTerm = '';
    this.render();
  }

  /**
   * Cleans up event listeners to prevent duplicates
   * @returns {void}
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

      const actorRadios = this.element.querySelectorAll('input[name="selectedActor"]');
      actorRadios.forEach(radio => {
        radio.removeEventListener('change', this._boundOnActorSelection);
      });
      
      /** @description Clear any pending search timeout */
      clearTimeout(this._searchTimeout);
    }
  }

  /**
   * Handles vendor selection clicks when displaying all vendors
   * @param {Event} event - The click event
   * @returns {void}
   */
  _onClickVendor(event) {
    const vendorButton = event.target.closest('[data-vendor-id]');
    if (!vendorButton) return;
    
    const vendorId = vendorButton.dataset.vendorId;
    if (vendorId) {
      this.vendorId = vendorId;
      this.searchTerm = ''; /** @description Reset search when switching vendors */
      this.render();
    }
  }

  /**
   * Handles search input with debouncing
   * @param {Event} event - The input event
   * @returns {void}
   */
  _onSearchInput(event) {
    /** @description Clear any existing timeout */
    clearTimeout(this._searchTimeout);
    
    /** @description Set a new timeout to debounce the search */
    this._searchTimeout = setTimeout(() => {
      this.searchTerm = event.target.value;
      this.render();
    }, 300);
  }

  /**
   * Updates the visibility of the clear search button
   * @returns {void}
   */
  _updateClearButtonVisibility() {
    const clearSearchBtn = this.element.querySelector('#clearSearch');
    if (clearSearchBtn) {
      /** @description Toggle the 'hidden' class based on whether searchTerm is empty */
      clearSearchBtn.classList.toggle('hidden', !this.searchTerm);
    }
  }

  /**
   * Handles socket events from other clients
   * @param {Object} data - The socket event data
   * @returns {void}
   */
  _onSocketEvent(data) {
    /** @description Only handle events for this user */
    if (data.userId !== game.user.id) return;
    
    if (VendorWalletSystem.getDebugMode()) {
      console.log('💰 DEBUG: Socket event received:', data.type, data);
    }
    
    switch (data.type) {
      case SOCKET_EVENTS.PURCHASE_COMPLETED:
        ui.notifications.info(data.message);
        if (VendorWalletSystem.getDebugMode()) {
          console.log('💰 DEBUG: Purchase completed, refreshing wallet display');
        }
        /** @description Check if element still exists before clearing selection */
        if (this.element) {
          this._clearSelection();
          /** @description Force a complete re-render to update wallet display */
          setTimeout(() => {
            this.render(true);
          }, 100);
        }
        break;
      case SOCKET_EVENTS.PURCHASE_FAILED:
        ui.notifications.warn(data.message);
        if (VendorWalletSystem.getDebugMode()) {
          console.log('💰 DEBUG: Purchase failed:', data.message);
        }
        break;
    }
  }

  /**
   * Handles item selection changes for purchase calculation
   * @param {Event} event - The change event
   * @returns {void}
   */
  _onItemSelection(event) {
    if (!event.target.classList.contains('item-checkbox') && !event.target.classList.contains('item-quantity-input')) return;
    
    this._updatePurchaseDisplay();
  }

  /**
   * Handles purchase action button clicks
   * @param {Event} event - The click event
   * @returns {void}
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
   * @returns {void}
   */
  _updatePurchaseDisplay() {
    /** @description Check if we're in vendor view and elements exist */
    const selectedCountElement = this.element.querySelector('#selectedCount');
    const totalPriceElement = this.element.querySelector('#totalPrice');
    const purchaseButton = this.element.querySelector('#purchaseSelected');
    
    /** @description If elements don't exist (e.g., not in vendor view), return early */
    if (!selectedCountElement || !totalPriceElement || !purchaseButton) {
      return;
    }
    
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

    /** @description Round up the total price */
    totalPrice = Math.ceil(totalPrice);

    selectedCountElement.textContent = selectedCount;
    totalPriceElement.textContent = VendorWalletSystem.currencyManager.formatCurrency(totalPrice);

    purchaseButton.disabled = selectedCount === 0;
  }

  /**
   * Clears all item selections
   * @returns {void}
   */
  _clearSelection() {
    if (!this.element) return; /** @description Safety check */
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
      userId: game.user.id,
      actorId: this.selectedActorId /** @description Pass the selected actor ID */
    });

    /** @description Clear selection and refresh if successful */
    if (this.element) {
      this._clearSelection();
      /** @description Only re-render if we're still displaying the same vendor */
      if (this.vendorId) {
        this.render();
      }
    }
  }

  /**
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    /** @description Clean up listeners */
    this._cleanupListeners();
    
    if (this._socketRegistered) {
      game.socket.off(VendorWalletSystem.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = false;
    }
    
    /** @description Clean up document click listener */
    if (this._documentClickListenerAdded) {
      document.removeEventListener('click', this._boundOnDocumentClick);
      this._documentClickListenerAdded = false;
    }

    return super.close(options);
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
      
      const api = game.modules.get('gurps-instant-bazaar').api;
      new api.applications.VendorItemEditApplication({ 
        vendorId: this.vendorId, 
        itemId: itemId 
      }).render(true);
    }
  }
}

/**
 * Selects a user actor for transactions, handling multiple actor scenarios
 * @param {string} [userId] - The user ID to get actors for (defaults to current user)
 * @param {string} [preselectedActorId] - Pre-selected actor ID to use
 * @returns {Promise<Actor|null>} The selected actor or null if none found/selected
 */
PlayerWalletApplication.selectUserActor = async function(userId = game.user.id, preselectedActorId = null) {
  /** @description Get user's actors with Owner permission */
  const userActors = getOwnedPlayerActors(userId);
  
  if (userActors.length === 0) {
    ui.notifications.error('No character with Owner permission found! Please check your character sheet permissions.');
    return null;
  } 
  
  /** @description If we have a preselected actor ID, use it */
  if (preselectedActorId) {
    const preselectedActor = userActors.find(actor => actor.id === preselectedActorId);
    if (preselectedActor) {
      return preselectedActor;
    }
  }
  
  if (userActors.length === 1) {
    return userActors[0];
  } else {
    /** @description Multiple actors - show selection dialog */
    const actorChoices = userActors.reduce((choices, actor) => {
      choices[actor.id] = actor.name;
      return choices;
    }, {});
    
    try {
      const selectedActorId = await Dialog.prompt({
        title: 'Select Character',
        content: `
          <div class="form-group">
            <label>Choose which character will be used for this transaction:</label>
            <select id="actorSelect">
              ${Object.entries(actorChoices).map(([id, name]) => 
                `<option value="${id}">${name}</option>`
              ).join('')}
            </select>
          </div>
        `,
        callback: (html) => html.find('#actorSelect').val()
      });
      
      return game.actors.get(selectedActorId);
    } catch (error) {
      /** @description User cancelled the dialog */
      return null;
    }
  }
};

/**
 * Centralized client-side purchase processing
 * @param {Object} options - Purchase options
 * @param {string} options.vendorId - The vendor ID
 * @param {Array<HTMLElement>} options.checkboxes - Selected item checkboxes
 * @param {HTMLElement} options.element - The DOM element containing the items
 * @param {string} [options.userId] - The user ID (defaults to current user)
 * @param {string} [options.actorId] - The actor ID to use for the purchase
 * @returns {Promise<void>}
 */
PlayerWalletApplication.processClientPurchase = async function({ vendorId, checkboxes, element, userId = game.user.id, actorId = null }) {
  if (VendorWalletSystem.getDebugMode()) {
    console.log("💰 CLIENT: Processing purchase request...");
    console.log("💰 CLIENT: Actor ID to use:", actorId);
  }
  
  if (!checkboxes || checkboxes.length === 0) return;

  /** @description Validate quantities first */
  for (const checkbox of checkboxes) {
    const itemId = checkbox.dataset.itemId;
    const quantityInput = element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
    const max = parseInt(quantityInput?.max);
    const quantity = parseInt(quantityInput?.value);
    if (!quantityInput || isNaN(quantity) || quantity < 1 || (!isNaN(max) && quantity > max)) {
      ui.notifications.warn('Invalid quantity selected.');
      return;
    }
  }

  /** @description Select target actor using centralized logic with preselected actor */
  const targetActor = await PlayerWalletApplication.selectUserActor(userId, actorId);
  
  if (!targetActor) return;
  if (game.settings.get(VendorWalletSystem.ID, 'debugMode')) {
    console.log("💰 CLIENT: Target actor selected:", targetActor.name);
  }

  /** @description Check actor's wallet (not user's wallet) */
  const actorWallet = VendorWalletSystem.currencyManager.getActorWallet(targetActor.id);
  if (VendorWalletSystem.getDebugMode()) {
    console.log("💰 CLIENT: Actor wallet amount:", actorWallet);
  }
  
  /** @description Collect selected items data */
  const vendor = VendorWalletSystem.getVendor(vendorId);
  if (!vendor) {
    ui.notifications.error('Vendor not found.');
    return;
  }

  const selectedItems = [];
  let totalCost = 0;
  
  for (const checkbox of checkboxes) {
    const itemId = checkbox.dataset.itemId;
    const quantityInput = element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
    const quantity = parseInt(quantityInput?.value) || 1;
    const vendorItem = vendor.items.find(item => item.id === itemId);
    if (vendorItem) {
      const itemCost = vendorItem.price * quantity;
      totalCost += itemCost;
      selectedItems.push({
        id: vendorItem.id,
        name: vendorItem.name,
        price: vendorItem.price,
        uuid: vendorItem.uuid,
        quantity: quantity
      });
    }
  }

  /** @description Check if actor has enough money BEFORE sending to GM */
  totalCost = Math.ceil(totalCost);
  if (actorWallet < totalCost) {
    ui.notifications.warn(`${targetActor.name} doesn't have enough money! Needs ${VendorWalletSystem.currencyManager.formatCurrency(totalCost)} but only has ${VendorWalletSystem.currencyManager.formatCurrency(actorWallet)}.`);
    return;
  }
  
  if (VendorWalletSystem.getDebugMode()) {
    console.log("💰 CLIENT: Selected items for purchase:", selectedItems);
    console.log("💰 CLIENT: Total cost:", totalCost);
    console.log("💰 CLIENT: Actor wallet:", actorWallet);
    
    /** @description Log the full names of selected items for debugging */
    for (const item of selectedItems) {
      const itemDoc = await fromUuid(item.uuid);
      console.log(`💰 CLIENT SELECTED: ${item.quantity}x "${itemDoc?.name || 'Unknown item'}" (UUID: ${item.uuid})`);
    }
  }
  
  /** @description If user is GM, process directly; otherwise send request to GM */
  if (game.user.isGM) {
    await VendorWalletSystem.transactionManager.processDirectPurchase(targetActor, vendorId, selectedItems);
  } else {
    await VendorWalletSystem.transactionManager.sendPurchaseRequestToGM(targetActor, vendorId, selectedItems, game.user.id);
  }
};