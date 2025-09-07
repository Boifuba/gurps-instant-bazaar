/**
 * @file Vendor manager application for managing existing vendors
 * @description Allows GMs to view, edit, and delete existing vendors
 */

import VendorWalletSystem from './main.js';

/**
 * @class VendorManagerApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for managing existing vendors
 */
export default class VendorManagerApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'vendor-manager',
    tag: 'div',
    window: {
      title: 'Manage Vendors',
      icon: 'fas fa-store-alt'
    },
    position: {
      width: 600,
      height: 500
    },
    classes: ['gurps-instant-bazaar']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/vendor-manager.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing vendors data
   */
  async _prepareContext() {
    const allVendors = VendorWalletSystem.getVendors();
    const vendors = Object.entries(allVendors).map(([id, vendor]) => ({
      id,
      ...vendor,
      itemCount: vendor.items ? vendor.items.length : 0
    }));

    return { vendors };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickAction.bind(this));
  }

  /**
   * Handles action button clicks
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickAction(event) {
    const action = event.target.dataset.action;
    const vendorId = event.target.dataset.vendorId;

    switch (action) {
      case 'edit':
        // Note: VendorEditApplication needs to be imported when available
        new window.VendorEditApplication({ vendorId }).render(true);
        break;
      case 'delete':
        await this._deleteVendor(vendorId);
        break;
      case 'toggle-active':
        await this._toggleVendorActive(vendorId);
        break;
      case 'view':
        // Note: VendorDisplayApplication needs to be imported when available
        new window.VendorDisplayApplication({ vendorId }).render(true);
        break;
    }
  }

  /**
   * Deletes a vendor after confirmation
   * @param {string} vendorId - The vendor ID to delete
   * @returns {Promise<void>}
   */
  async _deleteVendor(vendorId) {
    const vendor = VendorWalletSystem.getVendor(vendorId);
    if (!vendor) return;

    const confirmed = await Dialog.confirm({
      title: 'Delete Vendor',
      content: `<p>Are you sure you want to delete vendor "${vendor.name}"?</p><p>This action cannot be undone.</p>`
    });

    if (confirmed) {
      await VendorWalletSystem.deleteVendor(vendorId);
      ui.notifications.info(`Vendor "${vendor.name}" has been deleted.`);
      this.render();
    }
  }

  /**
   * Toggles a vendor's active status
   * @param {string} vendorId - The vendor ID to toggle
   * @returns {Promise<void>}
   */
  async _toggleVendorActive(vendorId) {
    const vendor = VendorWalletSystem.getVendor(vendorId);
    if (!vendor) return;

    vendor.active = !vendor.active;
    await VendorWalletSystem.updateVendor(vendorId, vendor);
    
    const status = vendor.active ? 'activated' : 'deactivated';
    ui.notifications.info(`Vendor "${vendor.name}" has been ${status}.`);
    this.render();
  }

  /**
   * Static method to refresh all open vendor manager applications
   * @returns {void}
   */
  static refreshVendors() {
    Object.values(ui.windows).forEach(app => {
      if (app instanceof VendorManagerApplication) {
        app.render(false);
      }
    });
  }
}