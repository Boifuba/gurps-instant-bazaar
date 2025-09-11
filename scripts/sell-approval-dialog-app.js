/**
 * @file Application for GM approval of player sales
 * @description Custom dialog for GMs to approve or decline player sell requests, with percentage adjustment
 */

import VendorWalletSystem from './main.js';

/**
 * @class SellApprovalDialog
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Dialog for GM to approve or decline a player's sell request
 */
export default class SellApprovalDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {Object} options - Application options
   * @param {string} options.actorName - Name of the actor making the sale
   * @param {string} options.userName - Name of the user making the sale
   * @param {Array} options.items - Array of items being sold
   * @param {number} options.totalValue - Total original value of the items
   * @param {number} options.automaticSellPercentage - Default sell percentage
   * @param {Function} resolve - Function to call when dialog is closed with a result
   * @param {Function} reject - Function to call if dialog is dismissed without a result
   */
  constructor({ actorName, userName, items, totalValue, automaticSellPercentage, resolve, reject }, options = {}) {
    super(options);
    this.actorName = actorName;
    this.userName = userName;
    this.items = items;
    this.totalValue = totalValue;
    this.automaticSellPercentage = automaticSellPercentage;
    this._resolve = resolve;
    this._reject = reject;
    this._actionTaken = false;
  }

  static DEFAULT_OPTIONS = {
    id: 'sell-approval-dialog',
    tag: 'form',
    window: {
      title: 'Approve Sale',
      icon: 'fas fa-coins'
    },
    position: {
      width: 450,
    },
    classes: ['gurps-instant-bazaar', 'dialog-app']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/templates/sell-approval-dialog.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object
   */
  async _prepareContext() {
    const finalPayment = (this.totalValue * this.automaticSellPercentage) / 100;
    return {
      actorName: this.actorName,
      userName: this.userName,
      items: this.items,
      totalValue: this.totalValue,
      automaticSellPercentage: this.automaticSellPercentage,
      finalPayment: finalPayment,
      formatCurrency: VendorWalletSystem.formatCurrency // Pass helper function
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    /** @description Only add click listeners to the buttons, not the entire element */
    const approveBtn = this.element.querySelector('[data-action="approve"]');
    const declineBtn = this.element.querySelector('[data-action="decline"]');
    
    if (approveBtn) {
      approveBtn.addEventListener('click', this._onClickButton.bind(this));
    }
    if (declineBtn) {
      declineBtn.addEventListener('click', this._onClickButton.bind(this));
    }
    
    /** @description Prevent dialog closing when clicking on content areas */
    const dialogContent = this.element.querySelector('.dialog-content');
    if (dialogContent) {
      dialogContent.addEventListener('click', function(event) {
        event.stopPropagation();
      });
    }
    
    /** @description Setup slider and input synchronization */
    const slider = this.element.querySelector('#sellPercentageSlider');
    const input = this.element.querySelector('#sellPercentage');
    const display = this.element.querySelector('#finalPaymentDisplay');
    
    const updatePayment = (percentage) => {
      const payment = (this.totalValue * percentage) / 100;
      display.textContent = VendorWalletSystem.formatCurrency(payment);
    };

    slider.addEventListener('input', function(event) {
      event.stopPropagation();
      input.value = this.value;
      updatePayment(parseInt(this.value));
    });
    
    input.addEventListener('input', function(event) {
      event.stopPropagation();
      const value = Math.max(0, Math.min(100, parseInt(this.value) || 0));
      this.value = value;
      slider.value = value;
      updatePayment(value);
    });

    /** @description Prevent dialog closing when clicking on controls */

    /** @description Initial update */
    updatePayment(parseInt(input.value));
  }

  /**
   * Handles button clicks for approval/decline
   * @param {Event} event - The click event
   * @returns {void}
   */
  _onClickButton(event) {
    const action = event.target.dataset.action;
    const percentageInput = this.element.querySelector('#sellPercentage');
    const percentage = parseInt(percentageInput?.value) || 0;

    if (action === 'approve') {
      this._actionTaken = true;
      this._resolve({ approved: true, percentage: percentage });
    } else if (action === 'decline') {
      this._actionTaken = true;
      this._resolve({ approved: false, percentage: 0 });
    }
    this.close();
  }

  /**
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    /** @description If the dialog is closed without a button click (e.g., by pressing ESC or clicking outside) we should resolve with false to indicate no approval. */
    if (this._resolve && !this._actionTaken) {
      this._resolve({ approved: false, percentage: 0 });
      this._resolve = null; /** @description Prevent multiple calls */
    }
    
    /** @description Clean up specific button listeners */
    const approveBtn = this.element?.querySelector('[data-action="approve"]');
    const declineBtn = this.element?.querySelector('[data-action="decline"]');
    
    if (approveBtn) {
      approveBtn.removeEventListener('click', this._onClickButton);
    }
    if (declineBtn) {
      declineBtn.removeEventListener('click', this._onClickButton);
    }
    
    return super.close(options);
  }
}