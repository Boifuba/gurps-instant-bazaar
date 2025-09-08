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
      template: 'modules/gurps-instant-bazaar/money-management.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing user wallet data
   */
  async _prepareContext() {
    const useModuleCurrency = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
    const denominations = game.settings.get(VendorWalletSystem.ID, 'currencyDenominations') || [];
    const users = game.users.filter(u => !u.isGM).map(user => ({
      id: user.id,
      name: user.name,
      wallet: VendorWalletSystem.currencyManager.getUserWallet(user.id)
    }));

    return { 
      users,
      useModuleCurrency,
      hasDenominations: denominations.length > 0
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickButton.bind(this));
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
   * Applies the same amount to all player wallets
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _applyToAllPlayers(event) {
    // Only GMs can manage money
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can manage player money!');
      return;
    }

    // Check if denominations are configured when not using module currency
    const useModuleCurrency = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
    const denominations = game.settings.get(VendorWalletSystem.ID, 'currencyDenominations') || [];
    
    if (!useModuleCurrency && denominations.length === 0) {
      ui.notifications.error('No currency denominations configured. Please configure currency settings first.');
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    
    const allMoneyInput = this.element.querySelector('#allMoneyInput');
    const amountChange = parseInt(allMoneyInput?.value) || 0;
    
    if (amountChange === 0) {
      ui.notifications.warn('Please enter a non-zero amount to apply to all players.');
      return;
    }
    
    const users = game.users.filter(u => !u.isGM);
    let updatedCount = 0;
    
    for (const user of users) {
      const currentWallet = VendorWalletSystem.currencyManager.getUserWallet(user.id);
      const newAmount = Math.max(0, currentWallet + amountChange);
      await VendorWalletSystem.currencyManager.setUserWallet(user.id, newAmount);
      
      // Update the UI directly without re-rendering the entire application
      const userItem = this.element.querySelector(`[data-user-id="${user.id}"]`);
      if (userItem) {
        const walletDisplay = userItem.querySelector('small');
        if (walletDisplay) {
          const currencyMode = useModuleCurrency ? '' : '\nFrom character sheet';
          walletDisplay.innerHTML = `Wallet: ${VendorWalletSystem.formatCurrency(newAmount)}${currencyMode ? '<br><small style="font-style: italic; color: #666;">' + currencyMode.trim() + '</small>' : ''}`;
        }
      }
      
      updatedCount++;
    }

    // Reset the all money input field to 0
    if (allMoneyInput) {
      allMoneyInput.value = '0';
    }

    const actionText = amountChange > 0 ? 'added to' : 'removed from';
    ui.notifications.info(`${VendorWalletSystem.formatCurrency(Math.abs(amountChange))} ${actionText} ${updatedCount} player wallets!`);
  }

  /**
   * Updates individual player wallets based on their input fields
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _updateIndividualWallets(event) {
    
    // Only GMs can manage money
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can manage player money!');
      return;
    }

    // Check if denominations are configured when not using module currency
    const useModuleCurrency = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
    const denominations = game.settings.get(VendorWalletSystem.ID, 'currencyDenominations') || [];
    
    if (!useModuleCurrency && denominations.length === 0) {
      ui.notifications.error('No currency denominations configured. Please configure currency settings first.');
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const inputs = this.element.querySelectorAll('.money-input');
    const users = game.users.filter(u => !u.isGM);
    let updatedCount = 0;
    
    for (const user of users) {
      const input = this.element.querySelector(`input[name="amount-${user.id}"]`);
      const amountChange = parseInt(input?.value) || 0;
      
      if (amountChange !== 0) {
        const currentWallet = VendorWalletSystem.currencyManager.getUserWallet(user.id);
        const newAmount = Math.max(0, currentWallet + amountChange);
        await VendorWalletSystem.currencyManager.setUserWallet(user.id, newAmount);
        
        // Update the UI directly without re-rendering the entire application
        const userItem = this.element.querySelector(`[data-user-id="${user.id}"]`);
        if (userItem) {
          const walletDisplay = userItem.querySelector('small');
          if (walletDisplay) {
            const currencyMode = useModuleCurrency ? '' : '\nFrom character sheet';
            walletDisplay.innerHTML = `Wallet: ${VendorWalletSystem.formatCurrency(newAmount)}${currencyMode ? '<br><small style="font-style: italic; color: #666;">' + currencyMode.trim() + '</small>' : ''}`;
          }
        }
        
        // Reset the input field to 0
        if (input) {
          input.value = '0';
        }
        
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      ui.notifications.info(`${updatedCount} player wallet${updatedCount > 1 ? 's' : ''} updated successfully!`);
    } else {
      ui.notifications.info('No changes were made to player wallets.');
      coinBreakdown = VendorWalletSystem.currencyManager.characterCurrencyService.getCharacterSheetCoinBreakdown(game.user.id);
      }
  }
}