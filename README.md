[![Donate](https://img.shields.io/badge/Donate-Sponsor%20on%20GitHub-black?logo=github)](https://github.com/sponsors/Boifuba)

# GURPS Instant Bazaar

A comprehensive FoundryVTT module that provides a complete vendor and wallet management system for Game Masters and players.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Installation](#installation)
4. [Quick Start Guide](#quick-start-guide)
5. [Player Guide](#player-guide)
   - [Accessing Your Wallet](#accessing-your-wallet)
   - [Browsing Vendors](#browsing-vendors)
   - [Purchasing Items](#purchasing-items)
6. [Game Master Guide](#game-master-guide)
   - [GM Tools Overview](#gm-tools-overview)
   - [Managing Player Money](#managing-player-money)
   - [Creating Vendors](#creating-vendors)
   - [Managing Vendors](#managing-vendors)
   - [Editing Individual Items](#editing-individual-items)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)
9. [Technical Information](#technical-information)
10. [Support](#support)

## Overview

The Vendor & Wallet System transforms your FoundryVTT game by adding a complete economic system. Players can manage their money through digital wallets, while Game Masters can create dynamic vendors with randomly generated inventories from any item compendium.

## Features

### For Players
- **Digital Wallet**: Track your character's money with an easy-to-use wallet system
- **Vendor Browsing**: View all available vendors and their inventories
- **Smart Shopping**: Search through vendor items and purchase multiple items at once
- **Automatic Inventory**: Purchased items are automatically added to your character sheet

### For Game Masters
- **Money Management**: Add or remove money from any player's wallet
- **Dynamic Vendors**: Create vendors with randomly generated inventories
- **Flexible Configuration**: Set price ranges, item quantities, and filtering options
- **Real-time Updates**: All changes sync instantly across all connected clients
- **Complete Control**: Edit, activate/deactivate, or delete vendors as needed

## Installation

- **Use this manifest**

https://raw.githubusercontent.com/Boifuba/gurps-instant-bazaar/refs/heads/main/module.json

## Quick Start Guide

### For Game Masters
1. Type `/shop` in chat to open GM Tools

2. Create your first vendor using **Create Vendor**
3. Add money to player wallets using **Manage Money**
4. Players can now browse and purchase from your vendors!

### For Players
1. Type `/shop` in chat to open your wallet and browse vendors

2. View your current wallet balance
3. Browse available vendors and their items
4. Select items and purchase them directly to your character

## Player Guide

### Accessing Your Wallet

The wallet system is your gateway to the game's economy:

1. **Find the Wallet Button**: Look for the wallet icon (💰) in the player list
2. **View Your Balance**: Your current money is displayed prominently
3. **Browse Vendors**: See all active vendors and their item counts

### Browsing Vendors

When you click on a vendor, you'll see:

- **Vendor Information**: Name and image (if set by the GM)
- **Your Wallet Balance**: Always visible so you know what you can afford
- **Item Search**: Use the search bar to quickly find specific items
- **Item Details**: Each item shows name, price, stock quantity, and page references

### Purchasing Items

The purchase system is designed to be intuitive and safe:

1. **Select Items**: Check the boxes next to items you want to buy
2. **Set Quantities**: Use the number inputs to choose how many of each item
3. **Review Prices**: The system shows your selected items count and the unit price for each item. The total cost is calculated when you confirm the purchase
4. **Purchase**: Click "Purchase Selected" to complete the transaction
5. **Automatic Processing**: Items are added to your character sheet automatically

**Important Notes**:
- You cannot purchase more items than are in stock
- You cannot spend more money than you have
- All purchases are processed through the GM for security
- Items are automatically added to your character's inventory after GM Approval.
- Displayed prices are per unit; the full cost is calculated during checkout

## Game Master Guide

### GM Tools Overview

Access all GM functionality through the **GM Tools** interface:

- **Manage Money**: Add or remove money from player wallets
- **Create Vendor**: Set up new vendors with random inventories
- **Manage Vendors**: Edit, activate/deactivate, or delete existing vendors

### Managing Player Money

The money management system gives you complete control over the economy:

1. **Open Money Management**: Click "Manage Money" in GM Tools
2. **View All Players**: See each player's current wallet balance
3. **Adjust Amounts**: Enter positive numbers to add money, negative to remove
4. **Apply Changes**: Click "Update All Wallets" to process all changes at once

**Tips**:
- Use positive numbers to reward players (quest rewards, treasure, etc.)
- Use negative numbers for expenses (taxes, fees, fines)
- Changes are applied immediately and visible to all players

### Creating Vendors

Create dynamic vendors with randomly generated inventories:

1. **Basic Information**:
   - **Vendor Name**: Choose a memorable name for your vendor
   - **Vendor Image**: Optional image to represent the vendor

2. **Inventory Configuration**:
   - **Number of Items**: How many different items the vendor will stock (1-100)
   - **Compendium**: Choose which item compendium to draw items from
   - **Price Range**: Set minimum and maximum values for item filtering

3. **Advanced Filters** (Optional):
   - **TL Filter**: Filter items by Tech Level (for sci-fi games)
   - **LC Filter**: Filter items by Legality Class (for GURPS games)

4. **Create**: Click "Create Vendor" to generate the vendor with random items

### Managing Vendors

The vendor manager provides complete oversight of your vendor network:

- **View**: Open a vendor's shop interface to see items and make test purchases
- **Edit**: Modify vendor settings and optionally regenerate inventory
- **Activate/Deactivate**: Control which vendors are visible to players
- **Delete**: Permanently remove vendors (with confirmation)

**Vendor Status Indicators**:
- **Active**: Green underline - visible to players
- **Inactive**: Dashed underline - hidden from players

### Editing Individual Items

Fine-tune your vendor inventories by editing individual items:

1. **Access Item Editor**: Click the edit icon (✏️) on any item in a vendor's inventory
2. **Modify Properties**:
   - **Item Name**: Change the display name
   - **Price**: Adjust the cost
   - **Weight**: Set the item weight
   - **Quantity**: Control stock levels

3. **Save or Remove**: Update the item or remove it entirely from the vendor

## Advanced Features

### Real-time Synchronization
- All vendor changes sync instantly across all connected clients
- Purchase transactions are processed in real-time
- Stock levels update immediately when items are purchased

### Smart Inventory Management
- Items are automatically added to character sheets with proper quantity handling
- Existing items have their quantities increased rather than creating duplicates
- Support for both standard items and equipment-type items

### Search and Filtering
- Players can search vendor inventories by item name
- Real-time search with instant results
- Clear search functionality for easy browsing

### Security Features
- Optional **Require GM Purchase Approval** setting to force manual authorization of player purchases
- All purchase requests are validated by the GM
- Players cannot purchase more than they can afford
- Stock levels are enforced to prevent overselling
- Wallet balances cannot go below zero

### Currency Settings Application
Game Masters can customize how money is handled in the module:

1. Open **GM Tools** (type `/shop` in chat) and click **Currency Settings**.
2. Enable **Use module currency system** to let the module manage all player funds.
3. (Optional) Enable **Optimize wallet on construct** so wallets automatically convert coins to the minimal number of pieces.
4. Enter the **Main Currency Name** (e.g. credits, dollars).
5. Under **Currency Denominations**, click **Add Coin** for each denomination you wish to support.
   - Provide the exact coin name and its value; every entry must be unique.
6. Click **Apply** to save your settings. Denominations are sorted from highest to lowest value.


## Troubleshooting

### Common Issues

**"No character with Owner permission found!"**
- Ensure your character sheet has proper ownership permissions
- Check that you have at least "Owner" level access to your character

**"Item not found in compendium"**
- Verify the compendium still exists and contains the item
- Try regenerating the vendor's inventory

**"Purchase request not processing"**
- Ensure a GM is online and connected
- Check that the vendor is still active
- Verify you have sufficient funds

**Items not appearing in inventory**
- Check your character sheet's items tab
- Look for quantity increases on existing items
- Ensure your character sheet is not filtered

### Performance Tips

- Limit vendor inventories to reasonable sizes (10-50 items)
- Use search functionality for large inventories
- Regularly clean up inactive vendors

## Technical Information

### System Requirements
- FoundryVTT v13 or higher


### Data Storage
- Player wallet data is stored in user flags
- Vendor data is stored in world settings
- All data persists between sessions

### Compatibility
- Works with drag-and-drop item systems
- Compatible with most character sheet modules
- Supports both standard and equipment-type items

### Socket Communication
- Real-time updates using FoundryVTT's socket system
- Secure purchase processing through GM validation
- Automatic synchronization across all clients

## Support

### Getting Help
1. Check this README for common solutions
2. Verify your FoundryVTT version compatibility
3. Test with a fresh world to isolate issues
4. Check the browser console for error messages

### Reporting Issues
When reporting problems, please include:
- FoundryVTT version
- GGA Version being used
- Steps to reproduce the issue
- Any console error messages
- Screenshots if applicable

### Feature Requests
We welcome suggestions for new features! Consider:
- How the feature would benefit gameplay
- Whether it fits the module's scope
- Potential implementation complexity

---

### Support the Project

Consider supporting the project to help ongoing development.


<a href="https://www.buymeacoffee.com/boifuba" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40">
</a>
