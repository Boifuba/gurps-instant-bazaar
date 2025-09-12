/**
 * @file Sell items application for players to sell their items
 * @description Allows players to select and sell items from their inventory
 */

import VendorWalletSystem from './main.js';
import { flattenItemsFromObject, getOwnedPlayerActors, getProcessedPlayerActorsData } from './utils.js';
import { SOCKET_EVENTS } from './socket-events.js';

/**
 * @class SellItemsApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for selling player items
 */
export default class SellItemsApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.searchTerm = '';
    this.selectedActorId = null;

    // Bind event handlers for later removal
    this._boundOnItemSelection = this._onItemSelection.bind(this);
    this._boundOnSellAction = this._onSellAction.bind(this);
    this._boundOnSearchInput = this._onSearchInput.bind(this);
    this._boundOnSocketEvent = this._onSocketEvent.bind(this);
    this._boundOnActorSelection = this._onActorSelection.bind(this);
    this._boundOnDocumentClick = this._onDocumentClick.bind(this);
    this._socketRegistered = false;
    this._documentClickListenerAdded = false;
  }

  static DEFAULT_OPTIONS = {
    id: 'sell-items',
    tag: 'div',
    window: {
      title: 'Sell Items',
      icon: 'fas fa-coins'
    },
    position: {
      width: 500
    },
    classes: ['gurps-instant-bazaar'],
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/templates/sell-items.hbs'
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
   * @returns {Promise<Object>} Context object containing items, wallet, and settings data
   */
  async _prepareContext() {
    // Get processed actors data using the utility function
    const actorsData = await getProcessedPlayerActorsData(this.selectedActorId);
    const { processedActors, selectedActor, selectedActorId, useModuleCurrency } = actorsData;
    
    // Update the internal selectedActorId
    this.selectedActorId = selectedActorId;
    
    // Get sell-specific settings
    const api = game.modules.get('gurps-instant-bazaar')?.api;
    const requireGMApproval = api?.system.getRequireGMApproval();
    const automaticSellPercentage = api?.system.getAutomaticSellPercentage();

    // Get player's character items
    const items = await this._getPlayerItems();
    
    // Filter items based on search term
    let filteredItems = items;
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchLower)
      );
    }

    return {
      items: filteredItems,
      selectedActor,
      selectedActorId: this.selectedActorId,
      useModuleCurrency,
      userActors: processedActors,
      requireGMApproval,
      automaticSellPercentage,
      searchTerm: this.searchTerm
    };
  }

  /**
   * Gets sellable items from the player's character
   * @returns {Promise<Array>} Array of sellable items
   */
  async _getPlayerItems() {
    const actor = game.actors.get(this.selectedActorId);

    if (!actor) return [];

    // Get currency denominations to filter out coins
    const api = game.modules.get('gurps-instant-bazaar')?.api;
    const denominations = api?.system.getCurrencyDenominations() || [];
    const coinNames = new Set(denominations.map(denom => denom.name.toLowerCase()));

    const items = [];
    
    // Get items from GURPS character sheet equipment.carried
    const carried = actor.system?.equipment?.carried;
    if (carried) {
      const carriedItems = flattenItemsFromObject(carried);
      
      for (const entry of carriedItems) {
        const itemData = entry.data;
        const quantity = itemData.count || 1;
        const price = itemData.cost || 0;
        
        // Only include items with quantity > 0 and price > 0, but exclude coins
        if (quantity > 0 && price > 0 && !coinNames.has(itemData.name.toLowerCase())) {
          items.push({
            id: entry.id,
            name: itemData.name,
            price: price,
            quantity: quantity,
            weight: parseFloat((itemData.weight || 0).toFixed(4)),
            pageref: itemData.pageref || '',
            uuid: itemData.uuid || `${actor.id}.${entry.id}`
          });
        }
      }
    }

    return items;
  }

  /**
   * Handles rendering events by setting up event listeners
   */
  _onRender() {
    // Clean up any existing listeners first
    this._cleanupListeners();
    
    // Register socket listener for sell results once
    if (!this._socketRegistered) {
      const api = game.modules.get('gurps-instant-bazaar')?.api;
      game.socket.on(api?.system.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = true;
    }

    // Add actor selection listeners for radio buttons
    const actorRadios = this.element.querySelectorAll('input[name="selectedActor"]');
    actorRadios.forEach(radio => {
      radio.addEventListener('change', this._boundOnActorSelection);
    });

    // Add sell system for players
    this.element.addEventListener('change', this._boundOnItemSelection);
    this.element.addEventListener('click', this._boundOnSellAction);

    // Add search functionality
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
   * Handles document clicks to close dropdowns
   * @param {Event} e - The click event
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
   */
  _onActorSelection(event) {
    // Handle radio button changes
    if (event.target.name === 'selectedActor') {
      this.selectedActorId = event.target.value;
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
      // Toggle the 'hidden' class based on whether searchTerm is empty
      clearSearchBtn.classList.toggle('hidden', !this.searchTerm);
    }
  }

  /**
   * Handles socket events from GM
   * @param {Object} data - The socket event data
   */
  _onSocketEvent(data) {
    // Only handle events for this user
    if (data.userId !== game.user.id) return;
    
    switch (data.type) {
      case SOCKET_EVENTS.SELL_COMPLETED:
        ui.notifications.info(data.message);
        // Check if element still exists before clearing selection
        if (this.element) {
          this._clearSelection();
          // Force a complete re-render to update wallet and items
          setTimeout(() => {
            this.render(true);
          }, 100);
        }
        break;
      case SOCKET_EVENTS.SELL_FAILED:
        ui.notifications.warn(data.message);
        break;
    }
  }

  /**
   * Handles item selection changes for sell calculation
   * @param {Event} event - The change event
   */
  _onItemSelection(event) {
    if (!event.target.classList.contains('item-checkbox') && !event.target.classList.contains('item-quantity-input')) return;
    
    this._updateSellDisplay();
  }

  /**
   * Handles sell action button clicks
   * @param {Event} event - The click event
   */
  _onSellAction(event) {
    const action = event.target.id;

    switch (action) {
      case 'sellSelected':
        this._sellSelectedItems();
        break;
      case 'clearSelection':
        this._clearSelection();
        break;
    }
  }

  /**
   * Updates the sell display with selected items count and total value
   */
  _updateSellDisplay() {
    const checkboxes = this.element.querySelectorAll('.item-checkbox:checked');
    let selectedCount = 0;
    let totalValue = 0;

    for (const checkbox of checkboxes) {
      const itemId = checkbox.dataset.itemId;
      const quantityInput = this.element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
      if (!quantityInput) continue;

      let quantity = parseInt(quantityInput.value) || 1;
      const max = parseInt(quantityInput.max);

      if (quantity < 1) quantity = 1;
      if (!isNaN(max) && quantity > max) quantity = max;

      quantityInput.value = quantity;

      const api = game.modules.get('gurps-instant-bazaar')?.api;
      const price = api?.system.parseCurrency(checkbox.dataset.price) || 0;
      totalValue += price * quantity;
      selectedCount += quantity;
    }

    this.element.querySelector('#selectedCount').textContent = selectedCount;
    this.element.querySelector('#totalValue').textContent = api?.system.formatCurrency(totalValue);

    const sellButton = this.element.querySelector('#sellSelected');
    sellButton.disabled = selectedCount === 0;
  }

  /**
   * Clears all item selections
   */
  _clearSelection() {
    if (!this.element) return; // Safety check
    const checkboxes = this.element.querySelectorAll('.item-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    this._updateSellDisplay();
  }

  /**
   * Processes the sale of selected items
   */
  async _sellSelectedItems() {
    const checkboxes = this.element.querySelectorAll('.item-checkbox:checked');
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

    // Get selected actor
    const actor = game.actors.get(this.selectedActorId);

    if (!actor) {
      ui.notifications.error('No character selected! Please select a character to sell items from.');
      return;
    }

    // Get all sellable items to match with selected checkboxes
    const allSellableItems = await this._getPlayerItems();
    
    // Collect selected items data by matching with the sellable items list
    const selectedItems = [];
    
    for (const checkbox of checkboxes) {
      const itemId = checkbox.dataset.itemId;
      const quantityInput = this.element.querySelector(`.item-quantity-input[data-item-id="${itemId}"]`);
      const quantity = parseInt(quantityInput?.value) || 1;
      
      // Find the item in our sellable items list
      const sellableItem = allSellableItems.find(item => item.id === itemId);
      
      if (sellableItem) {
        selectedItems.push({
          id: sellableItem.id,
          name: sellableItem.name,
          price: sellableItem.price,
          quantity: quantity,
          uuid: sellableItem.uuid
        });
      } else {
        console.warn(`Sellable item with ID ${itemId} not found in player's inventory`);
      }
    }

    if (selectedItems.length === 0) {
      ui.notifications.warn('No valid items selected for sale.');
      return;
    }

    const api = game.modules.get('gurps-instant-bazaar')?.api;
    if (api?.system.getDebugMode()) {
      console.log("💰 PLAYER: Selected items for sale:", selectedItems);
    }

    // Send sell request to GM via socket
    game.socket.emit(api?.system.SOCKET, {
      type: SOCKET_EVENTS.PLAYER_SELL_REQUEST,
      userId: game.user.id,
      actorId: actor.id,
      selectedItems: selectedItems
    });
    
    ui.notifications.info('Sell request sent for processing...');
  }

  /**
   * Cleans up event listeners to prevent duplicates
   */
  _cleanupListeners() {
    if (this.element) {
      this.element.removeEventListener('change', this._boundOnItemSelection);
      this.element.removeEventListener('click', this._boundOnSellAction);
      
      const searchInput = this.element.querySelector('#itemSearch');
      if (searchInput) {
        searchInput.removeEventListener('input', this._boundOnSearchInput);
      }

      const actorRadios = this.element.querySelectorAll('input[name="selectedActor"]');
      actorRadios.forEach(radio => {
        radio.removeEventListener('change', this._boundOnActorSelection);
      });
      
      // Clear any pending search timeout
      clearTimeout(this._searchTimeout);
    }
    
    // Clean up document click listener
    if (this._documentClickListenerAdded) {
      document.removeEventListener('click', this._boundOnDocumentClick);
      this._documentClickListenerAdded = false;
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
      const api = game.modules.get('gurps-instant-bazaar')?.api;
      game.socket.off(api?.system.SOCKET, this._boundOnSocketEvent);
      this._socketRegistered = false;
    }

    return super.close(options);
  }
}