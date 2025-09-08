# GURPS Instant Bazaar – API Reference (Foundry VTT v13)

Comprehensive JSDoc-style reference for the entire codebase. Each section lists
files, exported symbols, arguments, parameter types, and return values.

---

## Common Types

- **CoinBag**: object where each key is a coin name and the value is its count.
  Example: `{ gold: 1, silver: 2, copper: 5 }`.
- **WalletOptions**: options accepted by the `Wallet` constructor:
  - `optimizeOnConstruct` *(boolean)* – normalize coins when creating the wallet.
  - `optimizeOnAdd` *(boolean)* – recompute change when adding values.
  - `optimizeOnSubtract` *(boolean)* – recompute change when subtracting values.
  - `spendSmallestFirst` *(boolean)* – when paying, consume smaller coins first.
  - `repackAfterSubtract` *(RepackMode)* – strategy for regrouping coins after subtraction.
- **RepackMode** *(enum)*: used by `repackAfterSubtract`.
  - `"none"` – do not regroup coins after payment.
  - `"up"` – convert smaller coins into larger ones when possible.

## Índice
- [currency-crud.js](#file-currency-crudjs)
- [currency-settings-app.js](#file-currency-settings-appjs)
- [currency.js](#file-currencyjs)
- [form-utilities.js](#file-form-utilitiesjs)
- [gm-tools-app.js](#file-gm-tools-appjs)
- [item-drop-handler.js](#file-item-drop-handlerjs)
- [main.js](#file-mainjs)
- [money-management-app.js](#file-money-management-appjs)
- [player-wallet-app.js](#file-player-wallet-appjs)
- [sell-items-app.js](#file-sell-items-appjs)
- [settings.js](#file-settingsjs)
- [transaction-manager.js](#file-transaction-managerjs)
- [ui-integrations.js](#file-ui-integrationsjs)
- [utils.js](#file-utilsjs)
- [vendor-creation-app.js](#file-vendor-creation-appjs)
- [vendor-data-manager.js](#file-vendor-data-managerjs)
- [vendor-display-app.js](#file-vendor-display-appjs)
- [vendor-edit-app.js](#file-vendor-edit-appjs)
- [vendor-item-edit-app.js](#file-vendor-item-edit-appjs)
- [vendor-manager-app.js](#file-vendor-manager-appjs)

## File: `currency.js`


Utility functions and classes for coin-based currency.

### Functions

```javascript
/**
 * Check if a number is a non‑negative integer.
 * @function isNonNegInt
 * @param {number} n - Value to test.
 * @returns {boolean} True if `n` is an integer ≥ 0.
 */
```

```javascript
/**
 * Convert a bag of coins into total copper.
 * @function valueFromCoins
 * @param {CoinBag} [coins] - Object with `gold`, `silver`, and `copper` counts.
 * @param {{key:string, value:number}[]} [denominations] - Optional coin values.
 * @returns {number} Total value expressed in copper units.
 * @throws {Error} When any coin count is not a non‑negative integer.
 */
```

**Example**

```javascript
const total = valueFromCoins({ gold: 1, silver: 2, copper: 5 });
// total === 125
```

```javascript
/**
 * Break a copper total into an optimal set of coins.
 * @function makeChange
 * @param {number} total - Amount in copper to decompose.
 * @param {{key:string, value:number}[]} [denominations] - Optional coin values.
 * @returns {CoinBag} Bag with minimal coin counts.
 * @throws {Error} If `total` is negative or non‑integer.
 */
```

**Example**

```javascript
makeChange(125); // { gold: 1, silver: 2, copper: 5 }
```

```javascript
/**
 * Normalize a coin bag by recomputing optimal change.
 * @function normalizeCoins
 * @param {CoinBag} coins - Bag of coins to normalize.
 * @param {{key:string, value:number}[]} [denominations] - Optional coin values.
 * @returns {CoinBag} New bag using minimal coins.
 */
```

### Class: `Wallet`

```javascript
/**
 * Mutable purse that tracks coin counts.
 * @class Wallet
 * @param {CoinBag} [coins] - Starting coins.
 * @param {WalletOptions} [opts] - Normalization options.
 * @param {{key:string, value:number}[]} [denominations] - Optional coin values.
 */
```

```javascript
/**
 * Get wallet total in copper.
 * @method Wallet#total
 * @returns {number} Copper value of all coins.
 */
```

```javascript
/**
 * Add coins or copper to the wallet.
 * @method Wallet#add
 * @param {number|CoinBag} arg - Copper amount or coin bag.
 * @returns {Wallet} This wallet for chaining.
 * @throws {Error} When the value is invalid.
 */
```

**Example**

```javascript
const denom = [
  { name: "gold", value: 100 },
  { name: "silver", value: 10 },
  { name: "copper", value: 1 }
];
const wallet = new Wallet({ copper: 0 }, {}, denom);
wallet.add(125);
// wallet.toObject() => { gold: 1, silver: 2, copper: 5 }
```

```javascript
/**
 * Remove coins or copper from the wallet.
 * @method Wallet#subtract
 * @param {number|CoinBag} arg - Copper amount or coin bag.
 * @returns {Wallet} This wallet.
 * @throws {Error} If funds are insufficient.
 */
```

```javascript
/**
 * Recompute coin distribution using `normalizeCoins`.
 * @method Wallet#normalize
 * @returns {Wallet} This wallet.
 */
```

```javascript
/**
 * Convert wallet to a plain object.
 * @method Wallet#toObject
 * @returns {CoinBag} Bag representing current coins.
 */
```

```javascript
/**
 * Human‑readable string representation.
 * @method Wallet#toString
 * @returns {string} Formatted coin summary.
 */
```

### Class: `CurrencyManager`

```javascript
/**
 * Integrates wallets with Foundry actors and settings.
 * @class CurrencyManager
 * @param {boolean} useModuleCurrency - Whether to override actor currency.
 */
```

```javascript
/**
 * Format a copper value using current denominations.
 * @method CurrencyManager#formatCurrency
 * @param {number} amount - Amount in copper.
 * @returns {string} Formatted string.
 */
```

```javascript
/**
 * Parse a currency string back into copper.
 * @method CurrencyManager#parseCurrency
 * @param {string} value - String to parse.
 * @returns {number} Copper amount.
 */
```

```javascript
/**
 * Fetch a user’s wallet object.
 * @method CurrencyManager#getUserWallet
 * @param {string} userId - Foundry user id.
 * @returns {Wallet} Wallet instance.
 */
```

```javascript
/**
 * Set a user’s wallet total.
 * @method CurrencyManager#setUserWallet
 * @param {string} userId - Foundry user id.
 * @param {CoinBag|number} amount - New balance.
 * @returns {Promise<void>} Resolves when saved.
 */
```

```javascript
/**
 * Read coin items from a character sheet.
 * @method CurrencyManager#getCharacterSheetCurrency
 * @param {string} userId - Foundry user id.
 * @returns {CoinBag} Coins found on the actor.
 */
```

```javascript
/**
 * Refresh all open wallet applications.
 * @method CurrencyManager#refreshWalletApplications
 * @returns {void}
 */
```

```javascript
/**
 * Process purchase of an item.
 * @method CurrencyManager#processItemPurchase
 * @param {Actor} actor - Buying actor.
 * @param {Item} item - Item to purchase.
 * @param {string} vendorId - Vendor identifier.
 * @param {string} vendorItemId - Vendor item identifier.
 * @param {number} quantity - Number of copies.
 * @returns {Promise<{success:boolean,message:string}>} Result of the purchase.
 */
```

---

## File: `main.js`

Defines the `VendorWalletSystem` static controller.

```javascript
/**
 * Central module controller.
 * @namespace VendorWalletSystem
 */
```

```javascript
/**
 * Initialize settings, sockets, and helpers.
 * @function VendorWalletSystem.initialize
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Register all module settings.
 * @function VendorWalletSystem.registerSettings
 * @returns {void}
 */
```

```javascript
/**
 * Register socket listeners for live updates.
 * @function VendorWalletSystem.registerSocketListeners
 * @returns {void}
 */
```

```javascript
/**
 * Dispatch incoming socket events.
 * @function VendorWalletSystem.handleSocketEvent
 * @param {Object} data - Message payload.
 * @returns {void}
 */
```

```javascript
/**
 * Add a wallet button to the player list.
 * @function VendorWalletSystem.addPlayerWalletButton
 * @param {Application} app - Player list app.
 * @param {jQuery} html - Rendered HTML.
 * @returns {void}
 */
```

```javascript
/**
 * Format a copper value using the `CurrencyManager`.
 * @function VendorWalletSystem.formatCurrency
 * @param {number} amount - Copper amount.
 * @returns {string} Human readable currency.
 */
```

```javascript
/**
 * Parse a currency string into copper.
 * @function VendorWalletSystem.parseCurrency
 * @param {string} value - Formatted string.
 * @returns {number} Copper amount.
 */
```

```javascript
/**
 * Get a user’s wallet balance.
 * @function VendorWalletSystem.getUserWallet
 * @param {string} userId - Foundry user id.
 * @returns {Wallet} User wallet.
 */
```

```javascript
/**
 * Set a user’s wallet balance.
 * @function VendorWalletSystem.setUserWallet
 * @param {string} userId - Foundry user id.
 * @param {CoinBag|number} amount - New balance.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Retrieve all stored vendors.
 * @function VendorWalletSystem.getVendors
 * @returns {Object<string,VendorData>} Map of vendor ids to data.
 */
```

```javascript
/**
 * Get data for a single vendor.
 * @function VendorWalletSystem.getVendor
 * @param {string} vendorId - Identifier.
 * @returns {VendorData|undefined} Vendor record.
 */
```

```javascript
/**
 * Update vendor data and notify listeners.
 * @function VendorWalletSystem.updateVendor
 * @param {string} vendorId - Identifier.
 * @param {VendorData} vendorData - Updated data.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Remove a vendor from settings.
 * @function VendorWalletSystem.deleteVendor
 * @param {string} vendorId - Identifier.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Process a purchase initiated by a player.
 * @function VendorWalletSystem.processPlayerPurchaseRequest
 * @param {SocketRequest} data - Purchase request payload.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Send purchase result back to a user.
 * @function VendorWalletSystem.emitPurchaseResult
 * @param {string} userId - Recipient user id.
 * @param {boolean} success - Whether the purchase succeeded.
 * @param {string} message - Human readable result.
 * @param {Object} [payload] - Optional extra data.
 * @returns {void}
 */
```

```javascript
/**
 * Add an item to an actor's inventory.
 * @function VendorWalletSystem.addItemToActor
 * @param {Actor} actor - Destination actor.
 * @param {string} uuid - Item UUID.
 * @param {number} quantity - Number of copies.
 * @returns {Promise<Item>} The created item.
 */
```

```javascript
/**
 * Update vendor displays after data changes.
 * @function VendorWalletSystem.refreshVendorDisplays
 * @param {string} vendorId - Vendor to refresh.
 * @returns {void}
 */
```

```javascript
/**
 * Update all vendor managers after data changes.
 * @function VendorWalletSystem.refreshVendorManagers
 * @returns {void}
 */
```

```javascript
/**
 * Open all active vendors for the current user.
 * @function VendorWalletSystem.openAllAvailableVendors
 * @returns {void}
 */
```

```javascript
/**
 * Process an item purchase transaction.
 * @function VendorWalletSystem.processItemPurchase
 * @param {Actor} actor - Buying actor.
 * @param {Item} item - Item being purchased.
 * @param {string} vendorId - Vendor identifier.
 * @param {string} vendorItemId - Vendor item identifier.
 * @param {number} [quantity=1] - Quantity to purchase.
 * @returns {Promise<boolean>} True on success.
 */
```

```javascript
/**
 * Adjust quantity of a vendor's item.
 * @function VendorWalletSystem.updateItemQuantityInVendor
 * @param {string} vendorId - Vendor identifier.
 * @param {string} vendorItemId - Item identifier.
 * @param {number} change - Quantity delta.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Find which vendor sells a given item UUID.
 * @function VendorWalletSystem.findVendorByItemUuid
 * @param {string} itemUuid - Item UUID to search.
 * @returns {{vendorId:string,vendorItemId:string}|null} Match data or null.
 */
```

```javascript
/**
 * Handle items dropped onto an actor sheet.
 * @function VendorWalletSystem.handleItemDrop
 * @param {Actor} actor - Target actor.
 * @param {object} data - Drag data containing vendor info.
 * @returns {Promise<void>}
 */
```

---

## File: `gm-tools-app.js`

### Class: `GMToolsApplication`

```javascript
/**
 * Menu of GM utilities.
 * @class GMToolsApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Set up event listeners after rendering.
 * @method GMToolsApplication#_onRender
 * @returns {void}
*/
```

```javascript
/**
 * Handle tool button clicks.
 * @method GMToolsApplication#_onClickTool
 * @param {MouseEvent} event - Click event.
 * @returns {void}
 */
```

---

## File: `money-management-app.js`

### Class: `MoneyManagementApplication`

```javascript
/**
 * GM interface for adjusting player funds.
 * @class MoneyManagementApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Prepare context with user balances.
 * @method MoneyManagementApplication#_prepareContext
 * @returns {Promise<object>} Template data.
 */
```

```javascript
/**
 * Bind button events on render.
 * @method MoneyManagementApplication#_onRender
 * @returns {void}
 */
```

```javascript
/**
 * Handle update button click.
 * @method MoneyManagementApplication#_onClickButton
 * @param {MouseEvent} event - Click event.
 * @returns {Promise<void>}
 */
```

---

## File: `vendor-creation-app.js`

### Class: `VendorCreationApplication`

```javascript
/**
 * Wizard to create vendors with random items.
 * @class VendorCreationApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Prepare compendium list and defaults.
 * @method VendorCreationApplication#_prepareContext
 * @returns {Promise<object>} Context for template.
 */
```

```javascript
/**
 * Bind interactive events on render.
 * @method VendorCreationApplication#_onRender
 * @returns {void}
 */
```

```javascript
/**
 * Open file picker for image fields.
 * @method VendorCreationApplication#_onClickFilePicker
 * @param {Event} event - Click event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Attach currency formatting listeners.
 * @method VendorCreationApplication#_setupCurrencyListeners
 * @returns {void}
 */
```

```javascript
/**
 * Submit form to create vendor.
 * @method VendorCreationApplication#_onSubmitForm
 * @param {Event} event - Form submit event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Handle create button click.
 * @method VendorCreationApplication#_onClickCreate
 * @param {Event} event - Click event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Generate vendor and save settings.
 * @method VendorCreationApplication#_createVendor
 * @param {Event} event - Form submission event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Filter compendium items and select random entries.
 * @function generateRandomItems
 * @param {VendorData} vendorData - Criteria and metadata.
 * @returns {Promise<ItemData[]>} Array of item data.
 */
```

---

## File: `vendor-manager-app.js`

### Class: `VendorManagerApplication`

```javascript
/**
 * Overview window listing all vendors.
 * @class VendorManagerApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Assemble vendor metadata for rendering.
 * @method VendorManagerApplication#_prepareContext
 * @returns {Promise<object>} Template data.
 */
```

```javascript
/**
 * Bind action handlers on render.
 * @method VendorManagerApplication#_onRender
 * @returns {void}
 */
```

```javascript
/**
 * Handle edit/toggle/delete/view actions.
 * @method VendorManagerApplication#_onClickAction
 * @param {MouseEvent} event - Click event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Toggle vendor availability.
 * @method VendorManagerApplication#toggleVendor
 * @param {string} id - Vendor identifier.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Delete a vendor after confirmation.
 * @method VendorManagerApplication#deleteVendor
 * @param {string} id - Vendor identifier.
 * @returns {Promise<void>}
 */
```

---

## File: `vendor-edit-app.js`

### Class: `VendorEditApplication`

```javascript
/**
 * Editor for a single vendor.
 * @class VendorEditApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Prepare vendor data and compendium list.
 * @method VendorEditApplication#_prepareContext
 * @returns {Promise<object>} Template data.
 */
```

```javascript
/**
 * Bind form listeners on render.
 * @method VendorEditApplication#_onRender
 * @returns {void}
 */
```

```javascript
/**
 * Clean up listeners when closing.
 * @method VendorEditApplication#close
 * @param {object} options - Close options.
 * @returns {Promise<any>} Result of parent close.
 */
```

```javascript
/**
 * Open a file picker for image fields.
 * @method VendorEditApplication#_onClickFilePicker
 * @param {Event} event - Click event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Attach currency formatting listeners.
 * @method VendorEditApplication#_setupCurrencyListeners
 * @returns {void}
 */
```

```javascript
/**
 * Submit form to update vendor.
 * @method VendorEditApplication#_onSubmitForm
 * @param {Event} event - Submit event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Handle update button clicks.
 * @method VendorEditApplication#_onClickButton
 * @param {Event} event - Click event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Save vendor updates.
 * @method VendorEditApplication#_updateVendor
 * @param {Event} event - Form submission event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Select random compendium items based on filters.
 * @method VendorEditApplication#generateRandomItems
 * @param {Object} vendorData - Vendor criteria.
 * @returns {Promise<Array>} Array of generated items.
 */
```

---

## File: `vendor-item-edit-app.js`

### Class: `VendorItemEditApplication`

```javascript
/**
 * Editor for an individual vendor item.
 * @class VendorItemEditApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Prepare item and vendor context.
 * @method VendorItemEditApplication#_prepareContext
 * @returns {Promise<object>} Template data.
 */
```

```javascript
/**

 * Bind DOM event listeners after rendering.
 * @method VendorItemEditApplication#_onRender
 * @returns {void}
 */
```

```javascript
/**
 * Handle submission of the edit form.
 * @method VendorItemEditApplication#_onSubmitForm
 * @param {Event} event - Submit event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Handle button clicks for update or removal actions.
 * @method VendorItemEditApplication#_onClickButton
 * @param {Event} event - Click event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Apply item changes.
 * @method VendorItemEditApplication#_updateItem
 * @returns {Promise<void>} Resolves once the item is saved.
 */
```

```javascript
/**
 * Remove the item from the vendor after confirmation.
 * @method VendorItemEditApplication#_removeItem
 * @param {Event} event - Click event that initiated the removal.
 * @returns {Promise<void>} Resolves once the item has been removed.
 */
```

---

## File: `player-wallet-app.js`

### Class: `PlayerWalletApplication`

```javascript
/**
 * Combined wallet viewer and vendor browser for players.
 * @class PlayerWalletApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @param {object} [options] - Application options.
 */
```

```javascript
/**
 * Build context for template rendering.
 * @method PlayerWalletApplication#_prepareContext
 * @returns {Promise<object>} Template data.
 */
```

```javascript
/**
 * Handle vendor selection.
 * @method PlayerWalletApplication#_onClickVendor
 * @param {MouseEvent} event - Click event.
 * @returns {void}
 */
```

```javascript
/**
 * Process purchase of selected items.
 * @method PlayerWalletApplication#_onPurchaseAction
 * @param {MouseEvent} event - Click event.
 * @returns {Promise<void>}
 */
```

---

## File: `vendor-display-app.js`

### Class: `VendorDisplayApplication`

```javascript
/**
 * Stand‑alone window showing a vendor's inventory.
 * @class VendorDisplayApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @param {object} [options] - Application options.
 */
```

```javascript
/**
 * Prepare vendor data for rendering.
 * @method VendorDisplayApplication#_prepareContext
 * @returns {Promise<object>} Template data.
 */
```

```javascript
/**
 * Set up event listeners after rendering.
 * @method VendorDisplayApplication#_onRender
 * @returns {void}
 */
```

```javascript
/**
 * Handle item purchase clicks.
 * @method VendorDisplayApplication#_onPurchaseItem
 * @param {MouseEvent} event - Click event.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Refresh open displays for a specific vendor.
 * @function VendorDisplayApplication.refreshDisplays
 * @param {string} vendorId - Vendor identifier.
 * @returns {void}
 */
```

---

## File: `currency-settings-app.js`

### Class: `CurrencySettingsApplication`

```javascript
/**
 * Configure coin denominations and behavior.
 * @class CurrencySettingsApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Prepare current settings for rendering.
 * @method CurrencySettingsApplication#_prepareContext
 * @returns {Promise<object>} Template data.
 */
```

```javascript
/**
 * Save denomination changes.
 * @method CurrencySettingsApplication#_saveCurrencySettings
 * @param {Event} event - Form submission event.
 * @returns {Promise<void>}
 */
```

---

## File: `currency-crud.js`

### Functions

```javascript
/**
 * Create a fully populated GURPS coin item.
 * @function createCompleteGURPSCoinItem
 * @param {Object} denomination - Currency denomination configuration.
 * @param {number} [count=0] - Initial coin count.
 * @returns {Object} New coin item data.
 */
```

### Class: `CharacterCurrencyService`

```javascript
/**
 * Manage currency items on character sheets.
 * @class CharacterCurrencyService
 */
```

```javascript
/**
 * Get total currency value from a sheet.
 * @method CharacterCurrencyService#getCharacterSheetCurrency
 * @param {string} userId - User identifier.
 * @returns {number} Total value.
 */
```

```javascript
/**
 * Break down coins from a character sheet.
 * @method CharacterCurrencyService#getCharacterSheetCoinBreakdown
 * @param {string} userId - User identifier.
 * @returns {Array} Coin data entries.
 */
```

```javascript
/**
 * Set currency amount on a character sheet.
 * @method CharacterCurrencyService#setCharacterSheetCurrency
 * @param {string} userId - User identifier.
 * @param {number} newAmount - Desired amount.
 * @returns {Promise<boolean>} Success state.
 */
```

```javascript
/**
 * Add money directly to character coins.
 * @method CharacterCurrencyService#addMoneyToCharacterCoins
 * @param {Actor} actor - Target actor.
 * @param {number} amount - Amount to add.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Initialize placeholder coin items on actors.
 * @method CharacterCurrencyService#initializeMissingActorCoins
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Refresh any open wallet applications.
 * @method CharacterCurrencyService#refreshWalletApplications
 * @returns {void}
 */
```

---

## File: `form-utilities.js`

### Class: `FormUtilities`

```javascript
/**
 * Common helper methods for vendor forms.
 * @class FormUtilities
 */
```

```javascript
/**
 * Open a file picker and assign the result.
 * @method FormUtilities.handleFilePicker
 * @param {Event} event - Click event.
 * @param {HTMLElement} element - Form container.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Validate stock range input.
 * @method FormUtilities.validateStockRange
 * @param {number} stockMin - Minimum stock.
 * @param {number} stockMax - Maximum stock.
 * @returns {boolean} True if valid.
 */
```

```javascript
/**
 * Validate price range input.
 * @method FormUtilities.validatePriceRange
 * @param {number} minValue - Minimum price.
 * @param {number} maxValue - Maximum price.
 * @returns {boolean} True if valid.
 */
```

```javascript
/**
 * Parse a TL filter string.
 * @method FormUtilities.parseTLFilter
 * @param {string} tlFilterRaw - Raw TL string.
 * @returns {Array|null} Parsed values.
 */
```

```javascript
/**
 * Parse an LC filter value.
 * @method FormUtilities.parseLCFilter
 * @param {string} lcFilterValue - Raw LC value.
 * @returns {number|null} Parsed number.
 */
```

```javascript
/**
 * Generate random items from a compendium.
 * @method FormUtilities.generateRandomItems
 * @param {Object} vendorData - Generation settings.
 * @returns {Promise<Array>} Created item list.
 */
```

---

## File: `item-drop-handler.js`

### Functions

```javascript
/**
 * Process canvas item drops for vendor purchases.
 * @function handleCanvasItemDrop
 * @param {Canvas} canvas - Target canvas.
 * @param {Object|string} data - Drop payload.
 * @returns {Promise<boolean>} True to allow default handling.
 */
```

```javascript
/**
 * Register drop hooks.
 * @function initializeItemDropHandling
 * @returns {void}
 */
```

---

## File: `sell-items-app.js`

### Class: `SellItemsApplication`

```javascript
/**
 * Interface for players to sell inventory items.
 * @class SellItemsApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
```

```javascript
/**
 * Build context with items and wallet data.
 * @method SellItemsApplication#_prepareContext
 * @returns {Promise<Object>} Template data.
 */
```

```javascript
/**
 * Retrieve sellable items from the player's character.
 * @method SellItemsApplication#_getPlayerItems
 * @returns {Promise<Array>} Item list.
 */
```

```javascript
/**
 * Register UI listeners and socket events.
 * @method SellItemsApplication#_onRender
 * @returns {void}
 */
```

```javascript
/**
 * Debounced search handler.
 * @method SellItemsApplication#_onSearchInput
 * @param {Event} event - Input event.
 * @returns {void}
 */
```

```javascript
/**
 * Handle selection and quantity changes.
 * @method SellItemsApplication#_onItemSelection
 * @param {Event} event - Change event.
 * @returns {void}
 */
```

```javascript
/**
 * React to sell or clear buttons.
 * @method SellItemsApplication#_onSellAction
 * @param {Event} event - Click event.
 * @returns {void}
 */
```

```javascript
/**
 * Update display of selected items and total value.
 * @method SellItemsApplication#_updateSellDisplay
 * @returns {void}
 */
```

```javascript
/**
 * Clear all selections.
 * @method SellItemsApplication#_clearSelection
 * @returns {void}
 */
```

```javascript
/**
 * Send sell request to the GM.
 * @method SellItemsApplication#_sellSelectedItems
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Handle socket responses from the GM.
 * @method SellItemsApplication#_onSocketEvent
 * @param {Object} data - Socket payload.
 * @returns {void}
 */
```

```javascript
/**
 * Clean up listeners and socket hooks.
 * @method SellItemsApplication#close
 * @param {Object} [options] - Close options.
 * @returns {Promise<any>}
 */
```

---

## File: `transaction-manager.js`

### Class: `TransactionManager`

```javascript
/**
 * Handle purchase and sell transactions.
 * @class TransactionManager
 */
```

```javascript
/**
 * Send a purchase request to the GM.
 * @method TransactionManager#sendPurchaseRequestToGM
 * @param {Actor} targetActor - Buyer actor.
 * @param {string} vendorId - Vendor identifier.
 * @param {Array} selectedItems - Items to buy.
 * @param {string} userId - Player identifier.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Process a purchase directly on the GM client.
 * @method TransactionManager#processDirectPurchase
 * @param {Actor} targetActor - Buyer actor.
 * @param {string} vendorId - Vendor identifier.
 * @param {Array} selectedItems - Items to buy.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Handle a player's purchase request.
 * @method TransactionManager#processPlayerPurchaseRequest
 * @param {Object} data - Socket data.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Emit a purchase result back to a user.
 * @method TransactionManager#emitPurchaseResult
 * @param {string} userId - Target user ID.
 * @param {boolean} success - Whether it succeeded.
 * @param {string} message - Status message.
 * @param {Object} [data] - Extra payload.
 * @returns {void}
 */
```

```javascript
/**
 * Handle a player's sell request.
 * @method TransactionManager#processPlayerSellRequest
 * @param {Object} data - Socket data.
 * @returns {Promise<void>}
 */
```

```javascript
/**
 * Emit a sell result back to a user.
 * @method TransactionManager#emitSellResult
 * @param {string} userId - Target user ID.
 * @param {boolean} success - Whether it succeeded.
 * @param {string} message - Status message.
 * @param {Object} [data] - Extra payload.
 * @returns {void}
 */
```

```javascript
/**
 * Add an item to an actor's inventory.
 * @method TransactionManager#addItemToActor
 * @param {Actor} actor - Target actor.
 * @param {string} uuid - Item UUID.
 * @param {number} quantity - Quantity to add.
 * @returns {Promise<boolean>} Success state.
 */
```

---

## File: `ui-integrations.js`

### Functions

```javascript
/**
 * Add a wallet button to the player list.
 * @function addPlayerWalletButton
 * @param {Application} app - PlayerList application.
 * @param {jQuery} html - Rendered HTML.
 * @returns {void}
 */
```

```javascript
/**
 * Register UI hooks for wallet access.
 * @function initializeUIIntegrations
 * @returns {void}
 */
```

---

## File: `utils.js`

### Functions

```javascript
/**
 * Flatten nested equipment items into an array.
 * @function flattenItemsFromObject
 * @param {Object} obj - Equipment structure.
 * @returns {Array} Item entries.
 */
```

```javascript
/**
 * Find an item path within carried equipment.
 * @function findItemInCarried
 * @param {Object} carried - Equipment structure.
 * @param {string} itemId - Item identifier.
 * @param {string} [currentPath] - Current traversal path.
 * @returns {string|null} Path string or null.
 */
```

```javascript
/**
 * Retrieve an item by path from carried equipment.
 * @function getItemFromPath
 * @param {Object} carried - Equipment structure.
 * @param {string} path - Dot-separated item path.
 * @returns {Object|null} Item data or null.
 */
```

---

## File: `settings.js`

### Functions

```javascript
/**
 * Register module settings with FoundryVTT.
 * @function registerModuleSettings
 * @param {string} moduleId - Module identifier.
 * @returns {void}
 */
```

---

## File: `vendor-data-manager.js`

### Class: `VendorDataManager`

```javascript
/**
 * Manage vendor persistence and lookups.
 * @class VendorDataManager
 */
```

```javascript
/**
 * Retrieve all vendors from settings.
 * @method VendorDataManager#getVendors
 * @returns {Object} Vendor map.
 */
```

```javascript
/**
 * Retrieve a vendor by ID.
 * @method VendorDataManager#getVendor
 * @param {string} vendorId - Vendor identifier.
 * @returns {Object|undefined} Vendor data.
 */
```

```javascript
/**
 * Update a vendor and broadcast changes.
 * @method VendorDataManager#updateVendor
 * @param {string} vendorId - Vendor identifier.
 * @param {Object} vendorData - Updated data.
 * @returns {Promise<boolean>} Success state.
 */
```

```javascript
/**
 * Delete a vendor and broadcast changes.
 * @method VendorDataManager#deleteVendor
 * @param {string} vendorId - Vendor identifier.
 * @returns {Promise<boolean>} Success state.
 */
```

```javascript
/**
 * Adjust an item's quantity in a vendor.
 * @method VendorDataManager#updateItemQuantityInVendor
 * @param {string} vendorId - Vendor identifier.
 * @param {string} vendorItemId - Item identifier.
 * @param {number} change - Quantity delta.
 * @returns {Promise<boolean>} Success state.
 */
```

```javascript
/**
 * Locate a vendor containing a given item UUID.
 * @method VendorDataManager#findVendorByItemUuid
 * @param {string} itemUuid - Item UUID.
 * @returns {Object|null} Vendor and item info.
 */
```

---

## Supporting Files

- Handlebars templates (`*.hbs`) define UI layouts for each application.
- `styles.css` provides module-wide styling.
- `module.json` declares module metadata.
- `README.md`, `CHANGELOG.md`, and `LICENSE` document usage, history, and licensing.

