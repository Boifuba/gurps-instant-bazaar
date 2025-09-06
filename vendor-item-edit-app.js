/**
 * @file Vendor item edit application for modifying individual vendor items
 * @description Allows GMs to edit individual items within a vendor's inventory
 */

/**
 * @class VendorItemEditApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for editing individual vendor items
 */
class VendorItemEditApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {Object} options - Application options
   * @param {string} options.vendorId - The ID of the vendor
   * @param {string} options.itemId - The ID of the item to edit
   */
  constructor(options = {}) {
    super(options);
    this.vendorId = options.vendorId;
    this.itemId = options.itemId;
  }

  static DEFAULT_OPTIONS = {
    id: 'vendor-item-edit',
    tag: 'form',
    window: {
      title: 'Edit Vendor Item',
      icon: 'fas fa-edit'
    },
    position: {
      width: 350,
      height: 'auto'
    },
    classes: ['gurps-instant-bazaar']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/vendor-item-edit.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing item and vendor data
   */
  async _prepareContext() {
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    const item = vendor?.items.find(item => item.id === this.itemId);
    
    return { 
      item,
      vendor: vendor
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickButton.bind(this));
    this.element.addEventListener('submit', this._onSubmitForm.bind(this));
  }

  /**
   * Handles form submission
   * @param {Event} event - The submit event
   * @returns {Promise<void>}
   */
  async _onSubmitForm(event) {
    event.preventDefault();
    await this._updateItem();
  }

  /**
   * Handles button clicks for various actions
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickButton(event) {
    const action = event.target.dataset.action;

    switch (action) {
      case 'update-item':
        event.preventDefault();
        await this._updateItem();
        break;
      case 'remove-item':
        await this._removeItem(event);
        break;
    }
  }

  /**
   * Updates the item with form data
   * @returns {Promise<void>}
   */
  async _updateItem() {
    const form = this.element.querySelector('form');
    const formData = new FormData(form);
    
    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    const itemIndex = vendor.items.findIndex(item => item.id === this.itemId);
    
    if (itemIndex === -1) {
      ui.notifications.error('Item not found!');
      return;
    }

    // Update the item data
    vendor.items[itemIndex] = {
      ...vendor.items[itemIndex],
      name: formData.get('itemName'),
      price: parseInt(formData.get('itemPrice')),
      weight: parseFloat(formData.get('itemWeight')) || 0,
      quantity: parseInt(formData.get('itemQuantity')) || 1
    };

    await VendorWalletSystem.updateVendor(this.vendorId, vendor);
    
    ui.notifications.info('Item updated successfully!');
    this.close();
  }

  /**
   * Remove the item from the vendor after user confirmation.
   * @param {Event} event - Click event that initiated the removal.
   * @returns {Promise<void>} Resolves once the item has been removed.
   */
  async _removeItem(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({
      title: 'Remove Item',
      content: 'Are you sure you want to remove this item from the vendor?'
    });

    if (confirmed) {
      const vendor = VendorWalletSystem.getVendor(this.vendorId);
      vendor.items = vendor.items.filter(item => item.id !== this.itemId);
      
      await VendorWalletSystem.updateVendor(this.vendorId, vendor);
      
      ui.notifications.info('Item removed from vendor!');
      this.close();
    }
  }
}

window.VendorItemEditApplication = VendorItemEditApplication;
