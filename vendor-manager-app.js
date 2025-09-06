/**
 * @file Vendor manager application for managing all vendors
 * @description Allows GMs to view, edit, activate/deactivate, and delete vendors
 */

/**
 * @class VendorManagerApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for managing all vendors in the system
 */
class VendorManagerApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {...any} args - Constructor arguments
   */
  constructor(...args) {
    super(...args);
    this._onClickActionBound = this._onClickAction.bind(this);
  }
  
  static DEFAULT_OPTIONS = {
    id: 'vendor-manager',
    tag: 'form',
    window: {
      title: 'Manage Vendors',
      icon: 'fas fa-store-alt'
    },
    position: {
      width: 400,
    },
    classes: ["gurps-instant-bazaar"]
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/vendor-manager.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing all vendors data
   */
  async _prepareContext() {
    const vendors = VendorWalletSystem.getVendors();
    return {
      vendors: Object.entries(vendors).map(([id, vendor]) => ({
        id,
        ...vendor
      }))
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickActionBound);
  }

  /**
   * Handles action button clicks for vendor management
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickAction(event) {
    const action = event.target.dataset.action;
    const vendorId = event.target.closest('[data-vendor-id]')?.dataset.vendorId;
    
    if (!vendorId) return;

    switch (action) {
      case 'toggle':
        await this.toggleVendor(vendorId);
        break;
      case 'edit':
        new VendorEditApplication({ vendorId }).render(true);
        break;
      case 'delete':
        await this.deleteVendor(vendorId);
        break;
      case 'view': {
        const DisplayApp = globalThis.VendorDisplayApplication;
        if (DisplayApp) {
          new DisplayApp({ vendorId }).render(true);
        } else {
          console.error('VendorDisplayApplication is not defined');
        }
        break;
      }
    }
  }

  /**
   * Toggles a vendor's active status
   * @param {string} vendorId - The vendor ID to toggle
   * @returns {Promise<void>}
   */
  async toggleVendor(vendorId) {
    const vendor = VendorWalletSystem.getVendor(vendorId);
    vendor.active = !vendor.active;
    await VendorWalletSystem.updateVendor(vendorId, vendor);
    this.render();
  }

  /**
   * Deletes a vendor after confirmation
   * @param {string} vendorId - The vendor ID to delete
   * @returns {Promise<void>}
   */
  async deleteVendor(vendorId) {
    const confirmed = await Dialog.confirm({
      title: 'Delete Vendor',
      content: 'Are you sure you want to delete this vendor?'
    });

    if (confirmed) {
      await VendorWalletSystem.deleteVendor(vendorId);
      this.render();
    }
  }
}

// Make the manager accessible globally for other scripts and tests
globalThis.VendorManagerApplication = VendorManagerApplication;