/**
 * @file Currency settings application for configuring the module's financial system
 * @description Allows GMs to define currency names and denominations for the module's wallet system
 */

/**
 * @class CurrencySettingsApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for managing currency settings
 */
class CurrencySettingsApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'currency-settings',
    tag: 'form',
    window: {
      title: 'Currency Settings',
      icon: 'fas fa-money-bill-wave'
    },
    position: {
      width: 500,
      height: 'auto'
    },
    classes: ['gurps-instant-bazaar']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/currency-settings.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object
   */
  async _prepareContext() {
    // Load the current state of the module currency system setting
    const useModuleCurrencySystem = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
    
    // Load saved currency denominations or use defaults
    const denominations = game.settings.get(VendorWalletSystem.ID, 'currencyDenominations') || [
      { name: "Gold Coin", value: 80 },
      { name: "Silver Coin", value: 4 },
      { name: "Copper Farthing", value: 1 }
    ];

    return {
      useModuleCurrencySystem,
      denominations
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickButton.bind(this));
    this.element.addEventListener('submit', this._onSubmitForm.bind(this));
    
    // Set the checkbox state based on the current setting
    const useModuleCurrencyCheckbox = this.element.querySelector('#useModuleCurrencySystem');
    if (useModuleCurrencyCheckbox) {
      const currentSetting = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
      useModuleCurrencyCheckbox.checked = currentSetting;
    }
    
    // Populate denomination fields with saved data
    this._populateDenominationFields();
    
    // Ensure warning visibility is updated after initial render
    setTimeout(() => {
      this._updateWarningVisibility();
    }, 100);
  }

  /**
   * Populates the denomination fields with saved data
   */
  _populateDenominationFields() {
    const container = this.element.querySelector('#coinDenominationsContainer');
    if (!container) return;

    // Clear existing dynamic fields (keep the notes and warning)
    const existingFields = container.querySelectorAll('.coin-denomination-item');
    existingFields.forEach(field => field.remove());

    // Get denominations from context
    const context = this._prepareContext();
    context.then(data => {
      const denominations = data.denominations || [];
      
      // Add fields for each saved denomination
      denominations.forEach(denom => {
        this._addCoinDenominationField(denom.name, denom.value);
      });

      // Update warning visibility
      this._updateWarningVisibility();
    });
  }

  /**
   * Handles button clicks for various actions
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickButton(event) {
    // Handle clicks on remove buttons
    if (event.target.classList.contains('remove-coin-denomination') || 
        event.target.closest('.remove-coin-denomination')) {
      const fieldToRemove = event.target.closest('.coin-denomination-item');
      if (fieldToRemove) {
        fieldToRemove.remove();
        this._updateWarningVisibility();
      }
      return;
    }

    const action = event.target.dataset.action || event.target.id;

    switch (action) {
      case 'addCoinDenomination':
        this._addCoinDenominationField();
        this._updateWarningVisibility();
        break;
      case 'apply':
        event.preventDefault();
        await this._saveCurrencySettings();
        break;
      case 'cancel':
        // The onclick in the HBS template handles closing for now
        break;
    }
  }

  /**
   * Handles form submission
   * @param {Event} event - The submit event
   * @returns {Promise<void>}
   */
  async _onSubmitForm(event) {
    event.preventDefault();
    await this._saveCurrencySettings();
  }

  /**
   * Adds a new set of input fields for a coin denomination
   * @param {string} [name=''] - Pre-fill name value
   * @param {number} [value=''] - Pre-fill value
   */
  _addCoinDenominationField(name = '', value = '') {
    const container = this.element.querySelector('#coinDenominationsContainer');
    if (!container) return;

    // Check if we already have 3 denominations
    const existingFields = container.querySelectorAll('.coin-denomination-item');
    if (existingFields.length >= 3) {
      ui.notifications.warn('Maximum of 3 currency denominations allowed.');
      return;
    }
    const newField = document.createElement('div');
    newField.classList.add('form-group', 'coin-denomination-item');
    newField.innerHTML = `
      <div class="form-fields">
        <div class="form-field">
          <label>Coin Name:</label>
          <input type="text" name="coinName" placeholder="e.g., Gold Coin" value="${name}" required>
        </div>
        <div class="form-field">
          <label>Value per Coin:</label>
          <input type="number" name="coinValue" placeholder="e.g., 100" min="1" step="1" value="${value}" required>
        </div>
        <button type="button" class="secondary remove-coin-denomination" title="Remove Coin">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Insert the new field at the end of the container
    container.appendChild(newField);

    // Add event listener to the new remove button
    newField.querySelector('.remove-coin-denomination').addEventListener('click', (event) => {
      event.target.closest('.coin-denomination-item').remove();
      this._updateWarningVisibility();
    });

    // Update warning visibility after adding field
    this._updateWarningVisibility();
  }

  /**
   * Updates the visibility of the warning message based on denomination count
   */
  _updateWarningVisibility() {
    const container = this.element.querySelector('#coinDenominationsContainer');
    const warningElement = container?.querySelector('.warning-message');
    const denominationFields = container?.querySelectorAll('.coin-denomination-item');
    
    // Try multiple selectors to find the add button
    let addButton = this.element.querySelector('#addCoinDenomination');
    if (!addButton) {
      addButton = this.element.querySelector('[data-action="addCoinDenomination"]');
    }
    if (!addButton) {
      addButton = this.element.querySelector('button[type="button"]:not(.remove-coin-denomination)');
    }
    
    if (warningElement && denominationFields) {
      const count = denominationFields.length;
      warningElement.style.display = count !== 3 ? 'block' : 'none';
      
      // Hide add button if we already have 3 or more denominations
      if (addButton) {
        const parentElement = addButton.parentElement;
        if (count >= 3) {
          addButton.style.display = 'none';
          if (parentElement && parentElement.classList.contains('form-group')) {
            parentElement.style.display = 'none';
          }
        } else {
          addButton.style.display = 'inline-block';
          if (parentElement && parentElement.classList.contains('form-group')) {
            parentElement.style.display = 'block';
          }
        }
      } else {
        console.warn('Add coin button not found. Check template structure.');
      }
    }
  }

  /**
   * Saves the currency settings after validation
   * @returns {Promise<void>}
   */
  async _saveCurrencySettings() {
    // Save the module currency system setting
    const useModuleCurrencyCheckbox = this.element.querySelector('#useModuleCurrencySystem');
    const useModuleCurrencySystem = useModuleCurrencyCheckbox ? useModuleCurrencyCheckbox.checked : true;
    
    const container = this.element.querySelector('#coinDenominationsContainer');
    const denominationFields = container?.querySelectorAll('.coin-denomination-item');
    
    if (!denominationFields || denominationFields.length !== 3) {
      ui.notifications.error('You must define exactly 3 currency denominations.');
      this._updateWarningVisibility();
      return;
    }

    const denominations = [];
    const usedNames = new Set();

    // Collect and validate denominations
    for (const field of denominationFields) {
      const nameInput = field.querySelector('input[name="coinName"]');
      const valueInput = field.querySelector('input[name="coinValue"]');
      
      const name = nameInput?.value.trim();
      const value = parseInt(valueInput?.value);

      // Validate name
      if (!name) {
        ui.notifications.error('All coin names must be filled in.');
        return;
      }

      if (usedNames.has(name.toLowerCase())) {
        ui.notifications.error(`Duplicate coin name: "${name}". Each coin must have a unique name.`);
        return;
      }
      usedNames.add(name.toLowerCase());

      // Validate value
      if (!Number.isInteger(value) || value < 1) {
        ui.notifications.error(`Invalid value for "${name}". Values must be positive integers.`);
        return;
      }

      denominations.push({ name, value });
    }

    // Sort by value (descending) and validate order
    const sortedDenominations = [...denominations].sort((a, b) => b.value - a.value);
    const isCorrectOrder = denominations.every((denom, index) => 
      denom.value === sortedDenominations[index].value
    );

    if (!isCorrectOrder) {
      ui.notifications.error('Currency denominations must be ordered from highest to lowest value.');
      this._updateWarningVisibility();
      return;
    }

    // Validate that values are different
    const values = denominations.map(d => d.value);
    const uniqueValues = new Set(values);
    if (uniqueValues.size !== values.length) {
      ui.notifications.error('Each currency denomination must have a unique value.');
      return;
    }

    try {
      // Save both the module currency system setting and denominations
      await game.settings.set(VendorWalletSystem.ID, 'useModuleCurrencySystem', useModuleCurrencySystem);
      // Save the denominations
      await game.settings.set(VendorWalletSystem.ID, 'currencyDenominations', denominations);
      ui.notifications.info('Currency settings saved successfully!');
      this.close();
    } catch (error) {
      console.error('Error saving currency settings:', error);
      ui.notifications.error('Failed to save currency settings. Please try again.');
    }
  }
}

// Expose the application to the global scope so other scripts can access it
window.CurrencySettingsApplication = CurrencySettingsApplication;