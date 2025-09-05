/**
 * @file Vendor creation application for creating new vendors with random items
 * @description Allows GMs to create new vendors with randomly selected items from compendiums
 */

const { formatCurrency, parseCurrency } = require('./currency-service.js');
const { getVendors, MODULE_ID } = require('./vendor-service.js');

/**
 * @class VendorCreationApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for creating new vendors with configurable parameters
 */
class VendorCreationApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
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
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickCreate.bind(this));
    this.element.addEventListener('submit', this._onSubmitForm.bind(this));
    this.element.addEventListener('click', this._onClickFilePicker.bind(this));
    this._setupCurrencyListeners();
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

  _setupCurrencyListeners() {
    const fields = this.element.querySelectorAll('#minValue, #maxValue');
    fields.forEach(field => {
      field.addEventListener('focus', e => {
        e.target.value = e.target.value.replace(/[^0-9.-]+/g, '');
      });
      field.addEventListener('blur', e => {
        const value = parseFloat(e.target.value.replace(/[^0-9.-]+/g, '')) || 0;
        e.target.value = formatCurrency(value);
      });
      const value = parseFloat(field.value.replace(/[^0-9.-]+/g, '')) || 0;
      field.value = formatCurrency(value);
    });
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
   * Handles create button clicks
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickCreate(event) {
    if (event.target.dataset.action !== 'create') return;
    event.preventDefault();
    await this._createVendor();
  }

  /**
   * Creates a new vendor with the form data
   * @returns {Promise<void>}
   */
  async _createVendor() {
    const form = this.element.querySelector('form');
    const formData = new FormData(form);

    const tlFilterRaw = formData.get('tlFilter')?.trim();
    const tlFilterArray = tlFilterRaw
      ? tlFilterRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : null;
    const vendorData = {
      name: formData.get('name'),
      image: formData.get('vendorImage'),
      compendium: formData.get('compendium'),
      quantity: parseInt(formData.get('quantity')),
      stockMin: parseInt(formData.get('stockMin'), 10),
      stockMax: parseInt(formData.get('stockMax'), 10),

      minValue: parseCurrency(formData.get('minValue')),
      maxValue: parseCurrency(formData.get('maxValue')),

      tlFilter: tlFilterArray,
      lcFilter: formData.get('lcFilter') === '' ? null : parseInt(formData.get('lcFilter'), 10),

      active: true
    };

    if (vendorData.stockMin > vendorData.stockMax) {
      ui.notifications.error('Stock Min must be less than or equal to Stock Max');
      return;
    }

    const items = await this.generateRandomItems(vendorData);
    if (items === null) return;
    
    const vendor = {
      ...vendorData,
      items,
      id: foundry.utils.randomID()
    };

    const vendors = getVendors();
    vendors[vendor.id] = vendor;
    await game.settings.set(MODULE_ID, 'vendors', vendors);

    ui.notifications.info(`Vendor ${vendor.name} created with ${items.length} items!`);
    this.close();
  }

  /**
   * Generates random items for the vendor based on the provided criteria
   * @param {Object} vendorData - The vendor configuration data
   * @returns {Promise<Array|null>} Array of generated vendor items or null if invalid price range
   */
  async generateRandomItems(vendorData) {
    if (vendorData.minValue > vendorData.maxValue) {
      ui.notifications.error('Min Value must be less than or equal to Max Value');
      return null;
    }

    const pack = game.packs.get(vendorData.compendium);
    if (!pack) return [];

    const index = await pack.getIndex({ fields: ['name', 'img', 'system.eqt.techlevel', 'system.eqt.legalityclass'] });
    let filteredItems = Array.from(index);

    // Apply TL filter if specified
    if (vendorData.tlFilter) {
      console.log(`Applying TL filter [${vendorData.tlFilter.join(', ')}] to ${filteredItems.length} items`);
      filteredItems.forEach(item => {
        if (item.system?.eqt?.techlevel === undefined) {
          console.log(`Item sem TL: ${item.name}`);
        }
        if (item.system?.eqt?.legalityclass === undefined) {
          console.log(`Item sem LC: ${item.name}`);
        }
      });
      filteredItems = filteredItems.filter(item => {
        const tl = item.system?.eqt?.techlevel ?? '';

        return vendorData.tlFilter.includes(String(tl).toLowerCase());

      });
      console.log(`Items after TL filter: ${filteredItems.length}`);
    }

    // Apply LC filter if specified
    if (vendorData.lcFilter != null) {

      console.log(`Applying LC filter ≥ ${vendorData.lcFilter} to ${filteredItems.length} items`);

      filteredItems = filteredItems.filter(item => {
        const lcValue = item.system?.eqt?.legalityclass;
        const lc = lcValue === undefined || lcValue === '' ? null : parseInt(lcValue, 10);
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

      const price = item.system?.eqt?.cost || item.system?.cost || 0;

      items.push({
        id: foundry.utils.randomID(),
        name: item.name,
        price,
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

window.VendorCreationApplication = VendorCreationApplication;
