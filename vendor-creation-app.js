/**
 * @file Vendor creation application for creating new vendors with random items
 * @description Allows GMs to create new vendors with randomly selected items from compendiums
 */

import VendorWalletSystem from './main.js';
import FormUtilities from './form-utilities.js';

/**
 * @class VendorCreationApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for creating new vendors with configurable parameters
 */
export default class VendorCreationApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'vendor-creation',
    tag: 'form',
    window: {
      title: 'Create Vendor',
      icon: 'fas fa-store'
    },
    position: {
      width: 400,
    },
    classes: ["gurps-instant-bazaar"]
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/vendor-creation.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing available compendiums
   */
  async _prepareContext() {
    const compendiums = game.packs.filter(p => p.documentName === 'Item').map(p => ({
      id: p.collection,
      name: p.title
    }));

    return { compendiums };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    // Bind event handlers for later removal
    this._boundOnClickButton = this._onClickButton.bind(this);
    this._boundOnSubmitForm = this._onSubmitForm.bind(this);
    this._boundOnClickFilePicker = this._onClickFilePicker.bind(this);
    
    this.element.addEventListener('click', this._boundOnClickButton);
    this.element.addEventListener('submit', this._boundOnSubmitForm);
    this.element.addEventListener('click', this._boundOnClickFilePicker);
    this._setupCurrencyListeners();
  }

  /**
   * Sets up listeners for currency input fields to format values
   * @returns {void}
   */
  _setupCurrencyListeners() {
    const fields = this.element.querySelectorAll('#minValue, #maxValue');
    this._currencyFields = Array.from(fields);
    
    // Store bound handlers for later removal
    this._currencyFocusHandler = (e) => {
      e.target.value = e.target.value.replace(/[^0-9.-]+/g, '');
    };
    
    this._currencyBlurHandler = (e) => {
      const value = parseFloat(e.target.value.replace(/[^0-9.-]+/g, '')) || 0;
      e.target.value = VendorWalletSystem.formatCurrency(value);
    };
    
    this._currencyFields.forEach(field => {
      field.addEventListener('focus', this._currencyFocusHandler);
      field.addEventListener('blur', this._currencyBlurHandler);
      
      // Format initial values
      const value = parseFloat(field.value.replace(/[^0-9.-]+/g, '')) || 0;
      field.value = VendorWalletSystem.formatCurrency(value);
    });
  }

  /**
   * Handles file picker button clicks
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickFilePicker(event) {
    await FormUtilities.handleFilePicker(event, this.element);
  }

  /**
   * Handles form submission
   * @param {Event} event - The submit event
   * @returns {Promise<void>}
   */
  async _onSubmitForm(event) {
    event.preventDefault();
    await this._createVendor();
  }

  /**
   * Handles button clicks for various actions
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickButton(event) {
    const action = event.target.dataset.action;
    
    switch (action) {
      case 'create':
        event.preventDefault();
        await this._createVendor();
        break;
      case 'cancel':
        this.close();
        break;
    }
  }

  /**
   * Creates a new vendor with the form data
   * @returns {Promise<void>}
   */
  async _createVendor() {
    const form = this.element.querySelector('form');
    const formData = new FormData(form);

    const tlFilterArray = FormUtilities.parseTLFilter(formData.get('tlFilter'));
    const stockMin = parseInt(formData.get('stockMin'), 10);
    const stockMax = parseInt(formData.get('stockMax'), 10);
    const minValue = VendorWalletSystem.parseCurrency(formData.get('minValue'));
    const maxValue = VendorWalletSystem.parseCurrency(formData.get('maxValue'));

    // Validate stock range
    if (!FormUtilities.validateStockRange(stockMin, stockMax)) {
      return;
    }

    // Validate price range
    if (!FormUtilities.validatePriceRange(minValue, maxValue)) {
      return;
    }

    const vendorData = {
      name: formData.get('name'),
      image: formData.get('vendorImage'),
      compendium: formData.get('compendium'),
      quantity: parseInt(formData.get('quantity')),
      stockMin,
      stockMax,
      minValue,
      maxValue,
      tlFilter: tlFilterArray,
      lcFilter: FormUtilities.parseLCFilter(formData.get('lcFilter')),
      active: true
    };

    const items = await FormUtilities.generateRandomItems(vendorData);
    
    const vendor = {
      ...vendorData,
      items: items,
      id: foundry.utils.randomID()
    };

    const vendors = VendorWalletSystem.getVendors();
    vendors[vendor.id] = vendor;
    await game.settings.set(VendorWalletSystem.ID, 'vendors', vendors);

    ui.notifications.info(`Vendor ${vendor.name} created with ${items.length} items!`);
    this.close();
  }

  /**
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    // Clean up event listeners to prevent memory leaks
    if (this.element) {
      if (this._boundOnClickButton) {
        this.element.removeEventListener('click', this._boundOnClickButton);
      }
      if (this._boundOnSubmitForm) {
        this.element.removeEventListener('submit', this._boundOnSubmitForm);
      }
      if (this._boundOnClickFilePicker) {
        this.element.removeEventListener('click', this._boundOnClickFilePicker);
      }
      
      // Clean up currency field listeners
      if (this._currencyFields && this._currencyFocusHandler && this._currencyBlurHandler) {
        this._currencyFields.forEach(field => {
          field.removeEventListener('focus', this._currencyFocusHandler);
          field.removeEventListener('blur', this._currencyBlurHandler);
        });
      }
    }
    
    return super.close(options);
  }
}