/**
 * @file Vendor edit application for modifying existing vendors
 * @description Allows GMs to edit vendor properties and optionally regenerate items
 */

import VendorWalletSystem from './main.js';
import FormUtilities from './form-utilities.js';

/**
 * @class VendorEditApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for editing existing vendor data and settings
 */
export default class VendorEditApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {Object} options - Application options
   * @param {string} options.vendorId - The ID of the vendor to edit
   */
  constructor(options = {}) {
    super(options);
    this.vendorId = options.vendorId;
  }

  static DEFAULT_OPTIONS = {
    id: 'vendor-edit',
    tag: 'form',
    window: {
      title: 'Edit Vendor',
      icon: 'fas fa-edit'
    },
    position: {
      width: 400,
    },
    classes: ['gurps-instant-bazaar']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/templates/vendor-edit.hbs'
    }
  };

  /**
   * Prevents positioning errors when element is removed from DOM
   * @param {...any} args - Position arguments
   * @returns {any} Result of setPosition or undefined if element is not in DOM
    */
  setPosition(...args) {
    if (!this.element || !document.body.contains(this.element)) return;
    return super.setPosition(...args);
  }

  /**
   * Prevents position update errors when element is removed from DOM
   * @param {...any} args - Position arguments
   * @returns {any} Result of _updatePosition or undefined if element is not in DOM
   */
  _updatePosition(...args) {
    if (!this.element || !document.body.contains(this.element)) return;
    return super._updatePosition(...args);
  }

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing vendor and compendium data
   */
  async _prepareContext() {
    const vendor = { ...VendorWalletSystem.getVendor(this.vendorId) };
    if (vendor.stockMin === undefined) vendor.stockMin = 1;
    if (vendor.stockMax === undefined) vendor.stockMax = 1;
    const compendiums = game.packs.filter(p => p.documentName === 'Item').map(p => ({
      id: p.collection,
      name: p.title
    }));

    return { 
      vendor,
      compendiums
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    this._boundClickButton = this._onClickButton.bind(this);
    this._boundSubmitForm = this._onSubmitForm.bind(this);
    this._boundClickFilePicker = this._onClickFilePicker.bind(this);

    this.element.addEventListener('click', this._boundClickButton);
    this.element.addEventListener('submit', this._boundSubmitForm);
    this.element.addEventListener('click', this._boundClickFilePicker);
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
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    this.element.removeEventListener('click', this._boundClickButton);
    this.element.removeEventListener('submit', this._boundSubmitForm);
    this.element.removeEventListener('click', this._boundClickFilePicker);
    
    // Clean up currency field listeners
    if (this._currencyFields && this._currencyFocusHandler && this._currencyBlurHandler) {
      this._currencyFields.forEach(field => {
        field.removeEventListener('focus', this._currencyFocusHandler);
        field.removeEventListener('blur', this._currencyBlurHandler);
      });
    }
    
    return super.close(options);
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
    await this._updateVendor();
  }

  /**
   * Handles update button clicks
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickButton(event) {
    const action = event.target.dataset.action;
    
    switch (action) {
      case 'update':
        event.preventDefault();
        await this._updateVendor();
        break;
      case 'cancel':
        this.close();
        break;
    }
  }

  /**
   * Updates the vendor with form data
   * @returns {Promise<void>}
   */
  async _updateVendor() {
    const form = this.element.querySelector('form');
    const formData = new FormData(form);

    const vendor = VendorWalletSystem.getVendor(this.vendorId);
    const regenerateItems = formData.get('regenerateItems') === 'on';

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

    const updatedVendor = {
      ...vendor,
      name: formData.get('name'),
      image: formData.get('vendorImage'),
      compendium: formData.get('compendium'),
      quantity: parseInt(formData.get('quantity')),
      stockMin,
      stockMax,
      minValue,
      maxValue,
      tlFilter: tlFilterArray,
      lcFilter: FormUtilities.parseLCFilter(formData.get('lcFilter'))
    };

    if (regenerateItems) {
      updatedVendor.items = await FormUtilities.generateRandomItems(updatedVendor);
    }

    await VendorWalletSystem.updateVendor(this.vendorId, updatedVendor);

    ui.notifications.info(`Vendor ${updatedVendor.name} updated successfully!`);
    this.close();
  }
}