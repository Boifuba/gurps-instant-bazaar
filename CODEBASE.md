# GURPS Instant Bazaar – Full JSDoc Reference (Foundry VTT v13)

Extensive, auto-generated documentation for every major script.
Each section provides JSDoc-style summaries for classes and functions.
Use this file as a detailed reference when working with Foundry VTT v13.

## File: currency.js

Handles coin-based currency logic with Wallet and CurrencyManager classes.

### Functions

```javascript
/**
 * isNonNegInt(n)
 * Validates that the value is a non-negative integer.
 */
```

```javascript
/**
 * valueFromCoins(coins, denominations?)
 * Converts a coin bag into total copper value.
 */
```

```javascript
/**
 * makeChange(total, denominations?)
 * Breaks down copper into minimal coin counts.
 */
```

```javascript
/**
 * normalizeCoins(coins, denominations?)
 * Optimizes a coin bag by recomputing change.
 */
```

### Class: Wallet

```javascript
/**
 * Wallet.constructor(coins, opts, denominations)
 * Initializes wallet with optional normalization flags.
 */
```

```javascript
/**
 * Wallet.total()
 * Returns total copper value in the wallet.
 */
```

```javascript
/**
 * Wallet.add(arg)
 * Adds copper or coin bag to the wallet.
 */
```

```javascript
/**
 * Wallet.subtract(arg)
 * Spends copper or coin bag from the wallet.
 */
```

```javascript
/**
 * Wallet.normalize()
 * Re-optimizes the wallet's coin distribution.
 */
```

```javascript
/**
 * Wallet.toObject()
 * Produces a plain object snapshot of coins.
 */
```

```javascript
/**
 * Wallet.toString()
 * Generates a formatted string of coin counts.
 */
```

### Class: CurrencyManager

```javascript
/**
 * CurrencyManager.formatCurrency(amount)
 * Formats a copper amount as human-readable text.
 */
```

```javascript
/**
 * CurrencyManager.parseCurrency(value)
 * Parses formatted text into copper.
 */
```

```javascript
/**
 * CurrencyManager.getUserWallet(userId)
 * Retrieves the wallet associated with a user.
 */
```

```javascript
/**
 * CurrencyManager.setCharacterSheetCurrency(userId, amount)
 * Writes a value directly onto a character sheet.
 */
```

```javascript
/**
 * CurrencyManager.processItemPurchase(actor, item, vendorId, vendorItemId, quantity)
 * Handles full purchase workflow.
 */
```

## File: main.js

Entry point defining the static VendorWalletSystem controller.

### Class: VendorWalletSystem

```javascript
/**
 * VendorWalletSystem.initialize()
 * Registers settings, sockets, and helpers.
 */
```

```javascript
/**
 * VendorWalletSystem.registerSettings()
 * Creates world and client settings.
 */
```

```javascript
/**
 * VendorWalletSystem.registerSocketListeners()
 * Sets up socket communication.
 */
```

```javascript
/**
 * VendorWalletSystem.addPlayerWalletButton(app, html)
 * Injects wallet button into player list.
 */
```

```javascript
/**
 * VendorWalletSystem.getUserWallet(userId)
 * Returns the wallet for a specific user.
 */
```

```javascript
/**
 * VendorWalletSystem.setUserWallet(userId, amount)
 * Persists a wallet value for a user.
 */
```

```javascript
/**
 * VendorWalletSystem.formatCurrency(amount)
 * Formats currency using current settings.
 */
```

```javascript
/**
 * VendorWalletSystem.parseCurrency(value)
 * Parses a currency string into copper.
 */
```

```javascript
/**
 * VendorWalletSystem.getModuleCurrencyBreakdown(userId)
 * Provides coin distribution for the user.
 */
```

```javascript
/**
 * VendorWalletSystem.getVendors()
 * Fetches all vendor records.
 */
```

```javascript
/**
 * VendorWalletSystem.getVendor(id)
 * Looks up a single vendor.
 */
```

```javascript
/**
 * VendorWalletSystem.updateVendor(id, data)
 * Saves vendor updates to settings.
 */
```

```javascript
/**
 * VendorWalletSystem.deleteVendor(id)
 * Removes vendor from settings.
 */
```

```javascript
/**
 * VendorWalletSystem.refreshVendorDisplays(id)
 * Re-renders open vendor windows.
 */
```

```javascript
/**
 * VendorWalletSystem.refreshVendorManagers()
 * Refreshes vendor manager apps.
 */
```

```javascript
/**
 * VendorWalletSystem.openAllAvailableVendors()
 * Opens all active vendor windows.
 */
```

```javascript
/**
 * VendorWalletSystem.processPlayerPurchaseRequest(data)
 * Validates and forwards purchase requests.
 */
```

```javascript
/**
 * VendorWalletSystem.emitPurchaseResult(userId, success, message, data)
 * Sends purchase outcome to a client.
 */
```

```javascript
/**
 * VendorWalletSystem.processItemPurchase(actor, item, vendorId, vendorItemId, quantity)
 * Server-side purchase execution.
 */
```

```javascript
/**
 * VendorWalletSystem.updateItemQuantityInVendor(vendorId, itemId, change)
 * Adjusts inventory after purchase.
 */
```

```javascript
/**
 * VendorWalletSystem.addItemToActor(actor, uuid, quantity)
 * Places purchased items into an actor.
 */
```

```javascript
/**
 * VendorWalletSystem.findVendorByItemUuid(uuid)
 * Finds vendor containing a specific item.
 */
```

```javascript
/**
 * VendorWalletSystem.handleItemDrop(actor, data)
 * Processes drag-and-drop purchases.
 */
```

## File: gm-tools-app.js

GM dashboard offering quick links to administrative tools.

### Class: GMToolsApplication

```javascript
/**
 * GMToolsApplication._onRender()
 * Binds event listeners after rendering.
 */
```

```javascript
/**
 * GMToolsApplication._onClickTool(event)
 * Routes button clicks to specific GM applications.
 */
```

## File: money-management-app.js

GM interface to modify player wallets.

### Class: MoneyManagementApplication

```javascript
/**
 * MoneyManagementApplication._prepareContext()
 * Collects player data for display.
 */
```

```javascript
/**
 * MoneyManagementApplication._onRender()
 * Attaches the update button listener.
 */
```

```javascript
/**
 * MoneyManagementApplication._onClickButton(event)
 * Parses input and updates wallets.
 */
```

## File: vendor-creation-app.js

Wizard to create vendors with random items.

### Class: VendorCreationApplication

```javascript
/**
 * VendorCreationApplication._prepareContext()
 * Lists available compendia.
 */
```

```javascript
/**
 * VendorCreationApplication._onRender()
 * Registers UI handlers including file picker.
 */
```

```javascript
/**
 * VendorCreationApplication._onClickFilePicker(event)
 * Opens image selection dialog.
 */
```

```javascript
/**
 * VendorCreationApplication._setupCurrencyListeners()
 * Formats currency input fields.
 */
```

```javascript
/**
 * VendorCreationApplication._onClickCreate(event)
 * Validates and triggers vendor creation.
 */
```

```javascript
/**
 * VendorCreationApplication._createVendor()
 * Builds vendor data and saves it.
 */
```

```javascript
/**
 * VendorCreationApplication.generateRandomItems(vendorData)
 * Filters and selects random items.
 */
```

## File: vendor-manager-app.js

Overview window for existing vendors.

### Class: VendorManagerApplication

```javascript
/**
 * VendorManagerApplication._prepareContext()
 * Collects vendor metadata for rendering.
 */
```

```javascript
/**
 * VendorManagerApplication._onRender()
 * Activates button event listeners.
 */
```

```javascript
/**
 * VendorManagerApplication._onClickAction(event)
 * Delegates button actions.
 */
```

```javascript
/**
 * VendorManagerApplication.toggleVendor(vendorId)
 * Toggles availability of a vendor.
 */
```

```javascript
/**
 * VendorManagerApplication.deleteVendor(vendorId)
 * Removes vendor after confirmation.
 */
```

## File: vendor-edit-app.js

Editor for adjusting vendor properties and inventory.

### Class: VendorEditApplication

```javascript
/**
 * VendorEditApplication._prepareContext()
 * Loads vendor details and compendia list.
 */
```

```javascript
/**
 * VendorEditApplication._updatePosition(...args)
 * Positions the window within Foundry UI.
 */
```

```javascript
/**
 * VendorEditApplication._onRender()
 * Wires up UI controls after render.
 */
```

```javascript
/**
 * VendorEditApplication._setupCurrencyListeners()
 * Formats monetary inputs.
 */
```

```javascript
/**
 * VendorEditApplication._onClickFilePicker(event)
 * Invokes Foundry's file picker.
 */
```

```javascript
/**
 * VendorEditApplication._onClickButton(event)
 * Handles save and regenerate actions.
 */
```

```javascript
/**
 * VendorEditApplication._onSubmitForm(event)
 * Processes form submission.
 */
```

```javascript
/**
 * VendorEditApplication._updateVendor()
 * Saves edits and optional item regeneration.
 */
```

```javascript
/**
 * VendorEditApplication.generateRandomItems(vendorData)
 * Repopulates inventory based on filters.
 */
```

## File: vendor-item-edit-app.js

Editor focused on a single vendor item.

### Class: VendorItemEditApplication

```javascript
/**
 * VendorItemEditApplication._prepareContext()
 * Retrieves vendor and item details.
 */
```

```javascript
/**
 * VendorItemEditApplication._onRender()
 * Sets up button listeners.
 */
```

```javascript
/**
 * VendorItemEditApplication._onClickButton(event)
 * Routes save or delete operations.
 */
```

```javascript
/**
 * VendorItemEditApplication._updateItem()
 * Applies item changes and saves vendor.
 */
```

```javascript
/**
 * VendorItemEditApplication._removeItem()
 * Deletes item after confirmation.
 */
```

## File: player-wallet-app.js

Combined wallet viewer and vendor browser for players.

### Class: PlayerWalletApplication

```javascript
/**
 * PlayerWalletApplication._prepareContext()
 * Determines view mode and prepares data.
 */
```

```javascript
/**
 * PlayerWalletApplication._prepareSingleVendorContext(vendor, wallet, useModuleCurrency, coinBreakdown)
 * Builds context for a single vendor.
 */
```

```javascript
/**
 * PlayerWalletApplication._prepareAllVendorsContext(wallet, useModuleCurrency, coinBreakdown)
 * Builds context for all vendors.
 */
```

```javascript
/**
 * PlayerWalletApplication._updateWindowTitle()
 * Adjusts the window title based on context.
 */
```

```javascript
/**
 * PlayerWalletApplication._onBackToVendors(event)
 * Returns to vendor list view.
 */
```

```javascript
/**
 * PlayerWalletApplication._cleanupListeners()
 * Removes active event listeners.
 */
```

```javascript
/**
 * PlayerWalletApplication._onClickVendor(event)
 * Opens selected vendor.
 */
```

```javascript
/**
 * PlayerWalletApplication._onSearchInput(event)
 * Filters items based on search query.
 */
```

```javascript
/**
 * PlayerWalletApplication._updateClearButtonVisibility()
 * Shows or hides clear search button.
 */
```

```javascript
/**
 * PlayerWalletApplication._onSocketEvent(data)
 * Handles purchase result messages.
 */
```

```javascript
/**
 * PlayerWalletApplication._onItemSelection(event)
 * Tracks selected items for purchase.
 */
```

```javascript
/**
 * PlayerWalletApplication._onPurchaseAction(event)
 * Validates and executes purchase.
 */
```

```javascript
/**
 * PlayerWalletApplication._updatePurchaseDisplay()
 * Recalculates running total cost.
 */
```

```javascript
/**
 * PlayerWalletApplication._clearSelection()
 * Clears all selections and quantities.
 */
```

```javascript
/**
 * PlayerWalletApplication._onClickEditItem(event)
 * Opens item editor for GMs.
 */
```

## File: vendor-display-app.js

Standalone window for browsing a single vendor.

### Class: VendorDisplayApplication

```javascript
/**
 * VendorDisplayApplication._prepareContext()
 * Fetches vendor and wallet information.
 */
```

```javascript
/**
 * VendorDisplayApplication._onRender()
 * Registers event and socket listeners.
 */
```

```javascript
/**
 * VendorDisplayApplication._onSearchInput(event)
 * Filters visible items.
 */
```

```javascript
/**
 * VendorDisplayApplication._updateClearButtonVisibility()
 * Manages clear search button.
 */
```

```javascript
/**
 * VendorDisplayApplication._onSocketEvent(data)
 * Responds to purchase outcomes.
 */
```

```javascript
/**
 * VendorDisplayApplication._onItemSelection(event)
 * Tracks chosen items.
 */
```

```javascript
/**
 * VendorDisplayApplication._onPurchaseAction(event)
 * Initiates a purchase request.
 */
```

```javascript
/**
 * VendorDisplayApplication._updatePurchaseDisplay()
 * Recomputes total cost.
 */
```

```javascript
/**
 * VendorDisplayApplication._clearSelection()
 * Resets selections.
 */
```

```javascript
/**
 * VendorDisplayApplication._onClickEditItem(event)
 * Opens item editor (GM only).
 */
```

## File: currency-settings-app.js

UI to configure coin denominations and related options.

### Class: CurrencySettingsApplication

```javascript
/**
 * CurrencySettingsApplication._prepareContext()
 * Loads current settings and coin values.
 */
```

```javascript
/**
 * CurrencySettingsApplication._onRender()
 * Adds listeners for add/remove actions.
 */
```

```javascript
/**
 * CurrencySettingsApplication._populateDenominationFields()
 * Displays existing denomination rows.
 */
```

```javascript
/**
 * CurrencySettingsApplication._addCoinDenominationField(name, value)
 * Creates a new denomination row.
 */
```

```javascript
/**
 * CurrencySettingsApplication._updateWarningVisibility()
 * Shows warnings if rules are violated.
 */
```

```javascript
/**
 * CurrencySettingsApplication._onClickButton(event)
 * Handles button-based actions.
 */
```

```javascript
/**
 * CurrencySettingsApplication._saveCurrencySettings()
 * Validates and saves denomination settings.
 */
```

## Templates and Styles

- Handlebars templates (`*.hbs`) define UI layouts for all applications.
- styles.css provides module-wide styling rules.
- module.json registers metadata and entry scripts.

## Supporting Files

- README.md offers installation and usage instructions.
- CHANGELOG.md lists updates across versions.
- LICENSE states the terms of use (MIT).
