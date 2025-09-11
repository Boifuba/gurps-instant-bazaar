/**
 * @file Application for GM approval of player purchases
 * @description Custom dialog for GMs to approve or decline player purchase requests
 */

import VendorWalletSystem from './main.js';

/**
 * @class PurchaseApprovalDialog
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Dialog for GM to approve or decline a player's purchase request
 */
export default class PurchaseApprovalDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {Object} options - Application options
   * @param {string} options.actorName - Name of the actor making the purchase
   * @param {string} options.userName - Name of the user making the purchase
   * @param {Array} options.items - Array of items being purchased
   * @param {number} options.totalCost - Total cost of the purchase
   * @param {Function} resolve - Function to call when dialog is closed with a result
   * @param {Function} reject - Function to call if dialog is dismissed without a result
   */
  constructor({ actorName, userName, items, totalCost, resolve, reject }, options = {}) {
    super(options);
    this.actorName = actorName;
    this.userName = userName;
    this.items = items;
    this.totalCost = totalCost;
    this._resolve = resolve;
    this._reject = reject;
    this._actionTaken = false;
  }

  static DEFAULT_OPTIONS = {
    id: 'purchase-approval-dialog',
    tag: 'form',
    window: {
      title: 'Approve Purchase',
      icon: 'fas fa-shopping-cart'
    },
    position: {
      width: 400,
      height: 'auto'
    },
    classes: ['gurps-instant-bazaar', 'dialog-app']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/templates/purchase-approval-dialog.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object
   */
  async _prepareContext() {
    return {
      actorName: this.actorName,
      userName: this.userName,
      items: this.items,
      totalCost: this.totalCost,
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
  }

  /**
   * Handles button clicks for approval/decline
   * @param {Event} event - The click event
   * @returns {void}
   */
  _onClickButton(event) {
    const action = event.target.dataset.action;
    if (action === 'approve') {
      this._actionTaken = true;
      this._resolve(true);
    } else if (action === 'decline') {
      this._actionTaken = true;
      this._resolve(false);
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
      this._resolve(false);
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