/**
 * @file Vendor edit application for modifying existing vendors
 * @description Allows GMs to edit vendor properties and optionally regenerate items
 */

/**
 * @class VendorEditApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for editing existing vendor data and settings
 */
class VendorEditApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
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
      template: 'modules/gurps-instant-bazaar/vendor-edit.hbs'
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
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    this.element.removeEventListener('click', this._boundClickButton);
    this.element.removeEventListener('submit', this._boundSubmitForm);
    this.element.removeEventListener('click', this._boundClickFilePicker);
    return super.close(options);
  }

  /**
   * Handles file picker button clicks
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickFilePicker(event) {
    if (event.target.closest('.file-picker')) {
      event.preventDefault();
      const button = event.target.closest('.file-picker');
      const target = button.dataset.target;
      const type = button.dataset.type;
      
      const fp = new FilePicker({
        type: type,
        callback: (path) => {
          this.element.querySelector(`#${target}`).value = path;
        }
      });
      
      fp.render(true);
    }
  }

  /**
   * Sets up listeners for currency input fields to format values
   * @returns {void}
   */
  _setupCurrencyListeners() {
    const fields = this.element.querySelectorAll('#minValue, #maxValue');
    fields.forEach(field => {
      field.addEventListener('focus', e => {
        e.target.value = e.target.value.replace(/[^0-9.-]+/g, '');
      });
      field.addEventListener('blur', e => {
        const value = parseFloat(e.target.value.replace(/[^0-9.-]+/g, '')) || 0;
        e.target.value = VendorWalletSystem.formatCurrency(value);
      });
      const value = parseFloat(field.value.replace(/[^0-9.-]+/g, '')) || 0;
      field.value = VendorWalletSystem.formatCurrency(value);
    });
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
    if (event.target.dataset.action !== 'update') return;
    event.preventDefault();
    await this._updateVendor();
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

    const tlFilterRaw = formData.get('tlFilter')?.trim();
    const tlFilterArray = tlFilterRaw
      ? tlFilterRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : null;

    const stockMin = parseInt(formData.get('stockMin'), 10);
    const stockMax = parseInt(formData.get('stockMax'), 10);

    if (
      Number.isNaN(stockMin) ||
      Number.isNaN(stockMax) ||
      stockMin < 0 ||
      stockMax < 0 ||
      stockMin > stockMax
    ) {
      ui.notifications.error('Invalid stock range. Please ensure minimum and maximum are non-negative numbers and minimum is not greater than maximum.');
      return;
    }
    const updatedVendor = {
      ...vendor,
      name: formData.get('name'),
      image: formData.get('vendorImage'),
      compendium: formData.get('compendium'),
      quantity: parseInt(formData.get('quantity')),
      stockMin: parseInt(formData.get('stockMin'), 10),
      stockMax: parseInt(formData.get('stockMax'), 10),

      minValue: VendorWalletSystem.parseCurrency(formData.get('minValue')),
      maxValue: VendorWalletSystem.parseCurrency(formData.get('maxValue')),
      stockMin,
      stockMax,
      tlFilter: tlFilterArray,
      lcFilter: formData.get('lcFilter') === '' ? null : parseInt(formData.get('lcFilter'), 10)
      };
    if (updatedVendor.stockMin > updatedVendor.stockMax) {
      ui.notifications.error('Stock Min must be less than or equal to Stock Max');
      return;
    }

    if (regenerateItems) {
      updatedVendor.items = await this.generateRandomItems(updatedVendor);
    }

    await VendorWalletSystem.updateVendor(this.vendorId, updatedVendor);

    ui.notifications.info(`Vendor ${updatedVendor.name} updated successfully!`);
    this.close();
  }

  /**
   * Generates random items for the vendor based on the provided criteria
   * @param {Object} vendorData - The vendor configuration data
   * @returns {Promise<Array>} Array of generated vendor items
   */
  async generateRandomItems(vendorData) {
    const pack = game.packs.get(vendorData.compendium);
    if (!pack) return [];

    const index = await pack.getIndex({
      fields: ['system.eqt.techlevel', 'system.eqt.legalityclass']
    });
    let filteredItems = Array.from(index).map((item) => ({
      ...item,
      system: {
        ...(item.system || {}),
        eqt: {
          ...(item.system?.eqt || {}),
          techlevel: item.system?.eqt?.techlevel ?? null,
          legalityclass: item.system?.eqt?.legalityclass ?? null
        }
      }
    }));

    // Apply TL filter if specified
    if (vendorData.tlFilter) {
      console.log(`Applying TL filter [${vendorData.tlFilter.join(', ')}] to ${filteredItems.length} items`);
      filteredItems.forEach(item => {
        if (!item.system?.eqt?.techlevel) console.log(`Item sem TL: ${item.name}`);
        if (!item.system?.eqt?.legalityclass) console.log(`Item sem LC: ${item.name}`);
      });
      filteredItems = filteredItems.filter(item => {
        const tl = item.system?.eqt?.techlevel;
        if (tl == null || tl === '') return true;
        return vendorData.tlFilter.includes(String(tl).toLowerCase());
      });
      console.log(`Items after TL filter: ${filteredItems.length}`);
    }

    // Apply LC filter if specified
    if (vendorData.lcFilter != null) {

      console.log(`Applying LC filter ≥ ${vendorData.lcFilter} to ${filteredItems.length} items`);

      filteredItems = filteredItems.filter(item => {
        const lcValue = item.system?.eqt?.legalityclass;
        const lc = lcValue == null || lcValue === '' ? null : parseInt(lcValue, 10);
        const isIncluded = lc === null || lc >= vendorData.lcFilter;
        console.log(`LC check for "${item.name}": ${lc} -> ${isIncluded ? 'kept' : 'discarded'}`);
        return isIncluded;
      });
      console.log(`Items after LC filter: ${filteredItems.length} items`);
    }

    // Randomly select items
    const shuffled = filteredItems.sort(() => 0.5 - Math.random());
    const selectedItems = shuffled.slice(0, vendorData.quantity);

    const items = [];
    for (const indexItem of selectedItems) {
      const item = await pack.getDocument(indexItem._id);
      const minStock = Number.isInteger(vendorData.stockMin) ? vendorData.stockMin : 1;
      const maxStock = Number.isInteger(vendorData.stockMax) ? vendorData.stockMax : minStock;
      const quantity = Math.floor(Math.random() * (maxStock - minStock + 1)) + minStock;

      items.push({
        id: foundry.utils.randomID(),
        name: item.name,
        price: item.system?.eqt?.cost || item.system?.cost || 0,
        link: item.link,
        img: item.img,
        weight: item.system?.eqt?.weight || item.system?.weight || 0,
        pageref: item.system?.eqt?.pageref || item.system?.pageref || '',
        uuid: item.uuid,

        quantity

      });
    }

    return items;
  }
}

window.VendorEditApplication = VendorEditApplication;
