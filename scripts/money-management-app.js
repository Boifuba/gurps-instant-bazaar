/**
 * @file Money management application for GMs to manage player wallets
 * @description Allows Game Masters to add or remove money from player wallets
 */

import VendorWalletSystem from './main.js';

/**
 * @class MoneyManagementApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for managing player money (GM only)
 */
export default class MoneyManagementApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options = {}) {
    super(options);
    /** Bind event handler for later removal */
    this._boundOnClickButton = this._onClickButton.bind(this);
  }

  static DEFAULT_OPTIONS = {
    id: 'money-management',
    tag: 'form',
    window: {
      title: 'Manage Player Money',
      icon: 'fas fa-coins'
    },
    position: {
      width: 400,
    },
    classes: ['gurps-instant-bazaar']
  };
  
  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/templates/money-management.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing actor wallet data
   */
  async _prepareContext() {
    const useModuleCurrency = VendorWalletSystem.getUseModuleCurrencySystem();
    const denominations = VendorWalletSystem.getCurrencyDenominations();
    
    /** Get actors with their wallet balances (now async) */
    const actorList = game.actors.filter(a => a.hasPlayerOwner);
    const actors = [];
    
    for (const actor of actorList) {
      const wallet = await VendorWalletSystem.currencyManager.getActorWallet(actor.id);
      actors.push({
        id: actor.id,
        name: actor.name,
        wallet: wallet
      });
    }

    return { 
      actors,
      useModuleCurrency,
      hasDenominations: denominations.length > 0
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    /** Clean up any existing listeners first */
    this._cleanupListeners();
    
    /** Add the event listener using the bound function */
    this.element.addEventListener('click', this._boundOnClickButton);
  }

  /**
   * Cleans up event listeners to prevent duplicates
   * @returns {void}
   */
  _cleanupListeners() {
    if (this.element && this._boundOnClickButton) {
      this.element.removeEventListener('click', this._boundOnClickButton);
    }
  }

  /**
   * Handles button clicks for updating player wallets
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickButton(event) {
    const action = event.target.dataset.action;
    
    if (action === 'cancel') {
      this.close();
      return;
    }
    
    if (action === 'apply-to-all') {
      await this._applyToAllPlayers(event);
      return;
    }
    
    if (action === 'update-wallets') {
      await this._updateIndividualWallets(event);
      return;
    }
  }

  /**
   * Applies the same amount to all actor wallets
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _applyToAllPlayers(event) {
    /** Only GMs can manage actor money */
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can manage actor money!');
      return;
    }

    /** Check if denominations are configured when not using module currency */
    const useModuleCurrency = VendorWalletSystem.getUseModuleCurrencySystem();
    const denominations = VendorWalletSystem.getCurrencyDenominations();
    
    if (!useModuleCurrency && denominations.length === 0) {
      ui.notifications.error('No currency denominations configured. Please configure currency settings first.');
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    
    const allMoneyInput = this.element.querySelector('#allMoneyInput');
    const amountChange = parseInt(allMoneyInput?.value) || 0;
    
    if (amountChange === 0) {
      ui.notifications.warn('Please enter a non-zero amount to apply to all actors.');
      return;
    }
    
    const actors = game.actors.filter(a => a.hasPlayerOwner);
    let updatedCount = 0;
    
    for (const actor of actors) {
      const currentWallet = await VendorWalletSystem.currencyManager.getActorWallet(actor.id);
      const newAmount = Math.max(0, currentWallet + amountChange);
      const success = await VendorWalletSystem.currencyManager.setActorWallet(actor.id, newAmount);
      
      if (success) {
        updatedCount++;
      }
    }

    /** Reset the all money input field to 0 */
    if (allMoneyInput) {
      allMoneyInput.value = '0';
    }

    const actionText = amountChange > 0 ? 'added to' : 'removed from';
    ui.notifications.info(`${VendorWalletSystem.formatCurrency(Math.abs(amountChange))} ${actionText} ${updatedCount} actor wallets!`);
    
    /** Re-render the application to show updated values */
    this.render(false);
  }

  /**
   * Updates individual actor wallets based on their input fields
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _updateIndividualWallets(event) {
    
    /** Only GMs can manage actor money */
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can manage actor money!');
      return;
    }

    /** Check if denominations are configured when not using module currency */
    const useModuleCurrency = VendorWalletSystem.getUseModuleCurrencySystem();
    const denominations = VendorWalletSystem.getCurrencyDenominations();
    
    if (!useModuleCurrency && denominations.length === 0) {
      ui.notifications.error('No currency denominations configured. Please configure currency settings first.');
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const inputs = this.element.querySelectorAll('.money-input');
    const actors = game.actors.filter(a => a.hasPlayerOwner);
    let updatedCount = 0;
    
    for (const actor of actors) {
      const input = this.element.querySelector(`input[name="amount-${actor.id}"]`);
      const amountChange = parseInt(input?.value) || 0;
      
      if (amountChange !== 0) {
        const currentWallet = await VendorWalletSystem.currencyManager.getActorWallet(actor.id);
        const newAmount = Math.max(0, currentWallet + amountChange);
        const success = await VendorWalletSystem.currencyManager.setActorWallet(actor.id, newAmount);
        
        if (success) {
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      ui.notifications.info(`${updatedCount} actor wallet${updatedCount > 1 ? 's' : ''} updated successfully!`);
      /** Re-render the application to show updated values and reset input fields */
      this.render(false);
    } else {
      ui.notifications.info('No changes were made to actor wallets.');
    }
  }

  /**
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    /** Clean up event listeners to prevent memory leaks */
    this._cleanupListeners();
    
    return super.close(options);
  }
}