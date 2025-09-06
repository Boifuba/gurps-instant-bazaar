# GURPS Instant Bazaar – API Reference (Foundry VTT v13)

Comprehensive JSDoc-style reference for the entire codebase. Each section lists
files, exported symbols, arguments, parameter types, and return values.

---

## Tipos Comuns

- **CoinBag**: objeto onde cada chave representa o nome de uma moeda e o valor
  é a quantidade disponível. Exemplo: `{ ouro: 1, prata: 2, cobre: 5 }`.
- **WalletOptions**: opções aceitas pelo construtor de `Wallet`:
  - `optimizeOnConstruct` *(boolean)* – normaliza as moedas ao criar a carteira.
  - `optimizeOnAdd` *(boolean)* – recalcula o troco ao adicionar valores.
  - `optimizeOnSubtract` *(boolean)* – recalcula o troco ao subtrair valores.
  - `spendSmallestFirst` *(boolean)* – ao pagar, consome primeiro as moedas de
    menor valor.
  - `repackAfterSubtract` *(RepackMode)* – estratégia para reagrupar moedas
    depois de subtrair.
- **RepackMode** *(enum)*: usado por `repackAfterSubtract`.
  - `"none"` – não reagrupa as moedas após o pagamento.
  - `"up"` – converte moedas menores em maiores quando possível.

## Índice
- [currency.js](#file-currencyjs)
- [main.js](#file-mainjs)
- [gm-tools-app.js](#file-gm-tools-appjs)
- [money-management-app.js](#file-money-management-appjs)
- [vendor-creation-app.js](#file-vendor-creation-appjs)
- [vendor-manager-app.js](#file-vendor-manager-appjs)
- [vendor-edit-app.js](#file-vendor-edit-appjs)
- [vendor-item-edit-app.js](#file-vendor-item-edit-appjs)
- [player-wallet-app.js](#file-player-wallet-appjs)
- [vendor-display-app.js](#file-vendor-display-appjs)
- [currency-settings-app.js](#file-currency-settings-appjs)

## File: `currency.js` {#file-currencyjs}


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
 * @param {CoinBag} [coins] - Object with `ouro`, `prata`, and `cobre` counts.
 * @param {{key:string, value:number}[]} [denominations] - Optional coin values.
 * @returns {number} Total value expressed in copper units.
 * @throws {Error} When any coin count is not a non‑negative integer.
 */
```

**Exemplo**

```javascript
const total = valueFromCoins({ ouro: 1, prata: 2, cobre: 5 });
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

**Exemplo**

```javascript
makeChange(125); // { ouro: 1, prata: 2, cobre: 5 }
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

**Exemplo**

```javascript
const denom = [
  { name: "ouro", value: 100 },
  { name: "prata", value: 10 },
  { name: "cobre", value: 1 }
];
const wallet = new Wallet({ cobre: 0 }, {}, denom);
wallet.add(125);
// wallet.toObject() => { ouro: 1, prata: 2, cobre: 5 }
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

## File: `main.js` {#file-mainjs}

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

## File: `gm-tools-app.js` {#file-gm-tools-appjs}

### Class: `GMToolsApplication`

```javascript
/**
 * Menu of GM utilities.
 * @class GMToolsApplication
 * @extends Application
 */
```

```javascript
/**
 * Bind button events on render.
 * @method GMToolsApplication#_onRender
 * @param {Application} app - Application instance.
 * @param {jQuery} html - Rendered HTML.
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

## File: `money-management-app.js` {#file-money-management-appjs}

### Class: `MoneyManagementApplication`

```javascript
/**
 * GM interface for adjusting player funds.
 * @class MoneyManagementApplication
 * @extends Application
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

## File: `vendor-creation-app.js` {#file-vendor-creation-appjs}

### Class: `VendorCreationApplication`

```javascript
/**
 * Wizard to create vendors with random items.
 * @class VendorCreationApplication
 * @extends Application
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

## File: `vendor-manager-app.js` {#file-vendor-manager-appjs}

### Class: `VendorManagerApplication`

```javascript
/**
 * Overview window listing all vendors.
 * @class VendorManagerApplication
 * @extends Application
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

## File: `vendor-edit-app.js` {#file-vendor-edit-appjs}

### Class: `VendorEditApplication`

```javascript
/**
 * Editor for a single vendor.
 * @class VendorEditApplication
 * @extends Application
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

## File: `vendor-item-edit-app.js` {#file-vendor-item-edit-appjs}

### Class: `VendorItemEditApplication`

```javascript
/**
 * Editor for an individual vendor item.
 * @class VendorItemEditApplication
 * @extends Application
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

## File: `player-wallet-app.js` {#file-player-wallet-appjs}

### Class: `PlayerWalletApplication`

```javascript
/**
 * Combined wallet viewer and vendor browser for players.
 * @class PlayerWalletApplication
 * @extends Application
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

## File: `vendor-display-app.js` {#file-vendor-display-appjs}

### Class: `VendorDisplayApplication`

```javascript
/**
 * Stand‑alone window showing a vendor's inventory.
 * @class VendorDisplayApplication
 * @extends Application
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
 * Handle purchase button actions.
 * @method VendorDisplayApplication#_onPurchaseAction
 * @param {MouseEvent} event - Click event.
 * @returns {Promise<void>}
 */
```

---

## File: `currency-settings-app.js` {#file-currency-settings-appjs}

### Class: `CurrencySettingsApplication`

```javascript
/**
 * Configure coin denominations and behavior.
 * @class CurrencySettingsApplication
 * @extends Application
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

## Supporting Files

- Handlebars templates (`*.hbs`) define UI layouts for each application.
- `styles.css` provides module-wide styling.
- `module.json` declares module metadata.
- `README.md`, `CHANGELOG.md`, and `LICENSE` document usage, history, and licensing.

